/**
 * Silent-empty diagnostic reporter (Etapa 1, 2026-05-30).
 *
 * The external-db layer degrades to `{ records: [], count: 0 }` in several
 * NON-exceptional situations (bridge OFF, table not whitelisted, write with no
 * REST path, deterministic REST error). Historically these were invisible:
 * `logger.warn`/`logger.debug` are DEV-only, so PROD had zero signal and screens
 * silently rendered empty — impossible to diagnose.
 *
 * This module turns each silent-empty into:
 *   1. A structured record in a bounded ring buffer (drained by Etapa 2 telemetry
 *      and inspectable from the console via getSilentEmptyReport()).
 *   2. A DEDUPLICATED console line (one per table+reason per session) so DEV stays
 *      readable and PROD (error-level cases) is not flooded — the catalog page
 *      decomposes into dozens of calls, so naive logging would re-create the very
 *      flood the kill-switch was built to stop.
 *
 * It intentionally does NOT surface RLS under-returns: an RLS-filtered query
 * returns HTTP 200 with an empty array, indistinguishable from a legitimate
 * empty result. Detecting that belongs to the RLS audit (Etapa 6), not here.
 */
import { logger } from '@/lib/logger';

export type SilentEmptyReason =
  // (d) call site returned 410 Gone (migration/deprecation status)
  | 'gone_410'
  // (b) eligible SELECT hit a deterministic/terminal REST error (bad column, type…)
  | 'rest_error'
  // (a) SELECT on a table without a REST-native path while the bridge is OFF
  | 'table_not_whitelisted'
  // (c) insert/update/delete/upsert while the bridge is OFF → silent no-op
  | 'write_bridge_off';

export interface SilentEmptyEvent {
  reason: SilentEmptyReason;
  table: string;
  operation: string;
  message?: string;
  at: number;
}

const RING_CAPACITY = 100;
const ring: SilentEmptyEvent[] = [];
const dedup = new Set<string>();

/**
 * Reasons that indicate an actionable defect → logged at error level so they are
 * visible in PRODUCTION (logger.error is the only level that prints in prod).
 * `table_not_whitelisted` is high-volume and a config gap, not a runtime defect,
 * so it stays at warn (DEV-only).
 */
const ERROR_LEVEL_REASONS: ReadonlySet<SilentEmptyReason> = new Set<SilentEmptyReason>([
  'rest_error',
  'write_bridge_off',
  'gone_410',
]);

/**
 * Record a silent-empty occurrence. Always buffered; console line deduplicated
 * per (reason, table) for the lifetime of the session.
 */
export function reportSilentEmpty(event: Omit<SilentEmptyEvent, 'at'>): void {
  const record: SilentEmptyEvent = { ...event, at: Date.now() };

  // 1) Always record (bounded ring buffer = telemetry source for Etapa 2).
  ring.push(record);
  if (ring.length > RING_CAPACITY) ring.shift();

  // 2) Deduplicated console line (one per reason+table per session).
  const key = `${event.reason}:${event.table}`;
  if (dedup.has(key)) return;
  dedup.add(key);

  const ctx: Record<string, unknown> = {
    reason: event.reason,
    table: event.table,
    operation: event.operation,
    ...(event.message ? { message: event.message } : {}),
  };

  if (ERROR_LEVEL_REASONS.has(event.reason)) {
    logger.error(`[external-db] silent-empty (${event.reason}) on ${event.table}`, ctx);
  } else {
    logger.warn(`[external-db] silent-empty (${event.reason}) on ${event.table}`, ctx);
  }
}

/** Snapshot of recent silent-empty events (diagnostics / Etapa 2 telemetry). */
export function getSilentEmptyReport(): readonly SilentEmptyEvent[] {
  return ring.slice();
}

/** Aggregate counts keyed by `reason:table` — handy in the console. */
export function getSilentEmptySummary(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of ring) {
    const k = `${e.reason}:${e.table}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** Reset buffer + dedup (tests, or to re-arm dedup during a debugging session). */
export function resetSilentEmptyReport(): void {
  ring.length = 0;
  dedup.clear();
}
