/**
 * External DB Bridge — Core invocation layer.
 *
 * ARCHITECTURE (Phase 4B, 2026-06-01):
 *   1. invokeExternalDb: tries REST native FIRST (always succeeds — bridge is permanently OFF).
 *   2. invokeBatchBridge: decomposes directly to individual REST native calls.
 *   3. invokeBridge: stub that throws KillSwitchActiveError immediately.
 *
 * Kill-switch: enabled=false, rollout=100 → 100% REST native.
 * Phase 4B removed ~200 lines of dead retry/backoff/auth code from invokeBridge.
 */
import { logger } from '@/lib/logger';
import { getKillSwitchState, KillSwitchActiveError } from './kill-switch-client';
import {
  tryExecuteRestNative,
  isRestNativeEligible,
  runWithConcurrency,
  tryExecuteRestNativeWrite,
  isRestNativeWriteEligible,
} from './rest-native';
import { reportSilentEmpty } from './silent-empty-report';
import {
  recordBridgeCall,
  estimatePayloadBytes,
  type BridgeOperation,
} from '@/lib/telemetry/bridgeCallMetrics';
import { newRequestId } from '@/lib/telemetry/requestId';
import { recordKillSwitchHit } from './kill-switch-telemetry';
import { toErrorMessage } from '@/lib/to-error-message';

const KILL_SWITCH_NAME = 'edge_external_db_bridge';

export type Operation = 'batch_insert' | 'delete' | 'insert' | 'select' | 'update' | 'upsert';

const WRITE_OPERATIONS: ReadonlySet<Operation> = new Set<Operation>([
  'insert',
  'update',
  'delete',
  'upsert',
  'batch_insert',
]);

/** True para qualquer operação que MUTA dados (tudo menos 'select'). */
export function isWriteOperation(op: Operation | string | undefined): boolean {
  return !!op && WRITE_OPERATIONS.has(op as Operation);
}

/**
 * Lançado quando uma operação de ESCRITA não pôde ser executada porque a bridge
 * está OFF (REST nativo ainda não cobre escrita) ou está inacessível.
 */
export class WriteUnavailableError extends Error {
  table: string;
  operation: string;
  constructor(table: string, operation: string) {
    super(
      `Escrita indisponível: '${operation}' em '${table}' não pôde ser persistida ` +
        `(bridge OFF ou inacessível). Nenhum dado foi alterado.`,
    );
    this.name = 'WriteUnavailableError';
    this.table = table;
    this.operation = operation;
  }
}

export interface InvokeOptions<T = Record<string, unknown>> {
  table: string;
  operation: Operation;
  data?: T;
  id?: string;
  filters?: Record<string, unknown>;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  countMode?: 'estimated' | 'exact' | 'none' | 'planned';
  /** Conflict target column(s) for upsert (PostgREST onConflict). Defaults to the PK. */
  onConflict?: string;
}

export interface InvokeResult<T> {
  records: T[];
  count: number | null;
}

export interface BridgeResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface BatchQuery {
  table: string;
  operation?: 'select';
  select?: string;
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  cacheKey?: string;
}

export interface BatchResult {
  success: boolean;
  data?: { records: unknown[]; count: number | null };
  error?: string;
  fromCache?: boolean;
}

// ── Bridge invocation stub ────────────────────────────────────────────────────

/**
 * @deprecated Bridge decommissioned (kill-switch OFF since 2026-05-30).
 *
 * Always throws KillSwitchActiveError. The only caller (invokeBatchBridge) catches
 * this and decomposes to individual REST native calls via decomposeBatchToIndividual.
 *
 * Phase 4B (2026-06-01): removed ~100 lines of dead retry/backoff/auth/cold-start code.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function invokeBridge<T>(_body: Record<string, unknown>): Promise<BridgeResponse<T>> {
  throw new KillSwitchActiveError(KILL_SWITCH_NAME, 'Bridge OFF. REST nativo ativo.');
}

// ── Batch bridge ──────────────────────────────────────────────────────────────

async function decomposeBatchToIndividual(queries: BatchQuery[]): Promise<BatchResult[]> {
  logger.info(`[external-db] Decomposing ${queries.length} batch queries (concurrency=6)`);
  const tasks = queries.map((q) => async (): Promise<BatchResult> => {
    try {
      const result = await invokeExternalDb<Record<string, unknown>>({
        table: q.table,
        operation: q.operation ?? 'select',
        select: q.select,
        filters: q.filters,
        orderBy: q.orderBy,
        limit: q.limit,
        offset: q.offset,
      });
      return { success: true, data: { records: result.records, count: result.count } };
    } catch (e) {
      const msg = toErrorMessage(e);
      logger.warn(`[external-db] Batch decompose: ${q.table} failed: ${msg}`);
      return { success: false, error: msg };
    }
  });

  const settled = await runWithConcurrency(tasks);
  return settled.map((r) =>
    r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' },
  );
}

/**
 * @deprecated Bridge decommissioned — always decomposes directly to REST native calls.
 *
 * The original implementation tried the batch bridge endpoint first and fell back
 * to decomposition. Now goes straight to decomposition since bridge is permanently OFF.
 *
 * Phase 4B (2026-06-01): removed ~30 lines of dead try/catch/chunking code.
 */
export async function invokeBatchBridge(queries: BatchQuery[]): Promise<BatchResult[]> {
  return decomposeBatchToIndividual(queries);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function mapBridgeOp(op: Operation): BridgeOperation {
  return op === 'batch_insert' ? 'batch' : op;
}

function isCorsOrNetworkBridgeError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to send a request to the edge function') ||
    lower.includes('err_failed') ||
    lower.includes('cors') ||
    lower.includes('x-application-name') ||
    lower.includes('preflight') ||
    lower.includes('failed to fetch') ||
    lower.includes('network')
  );
}

/**
 * Smart routing:
 *   1. If eligible → REST native (fast path, always taken since bridge is OFF)
 *   2. If not eligible → check kill-switch, return empty
 */
export async function invokeExternalDb<T>(options: InvokeOptions): Promise<InvokeResult<T>> {
  const t0 = performance.now();
  const telemetryOp = mapBridgeOp(options.operation);
  const reqBytes = estimatePayloadBytes(options.data ?? options.filters ?? null);
  const recordCall = (ok: boolean, resp: unknown, errorMessage?: string): void => {
    recordBridgeCall({
      bridge: 'external-db-bridge',
      op: telemetryOp,
      target: options.table,
      durationMs: performance.now() - t0,
      reqBytes,
      respBytes: ok ? estimatePayloadBytes(resp) : 0,
      ok,
      errorMessage,
      requestId: newRequestId(),
    });
  };

  let bridgeEnabled = true;
  try {
    const switchState = await getKillSwitchState(KILL_SWITCH_NAME);
    bridgeEnabled = switchState.enabled;
  } catch {
    bridgeEnabled = true; // fail-open
  }

  // Fast path: REST native.
  if (isRestNativeEligible(options)) {
    const restResult = await tryExecuteRestNative<T>(options, { bridgeEnabled });
    if (restResult !== null) return restResult;
  }

  // Fast path WRITE: via PostgREST nativo + RLS.
  if (isRestNativeWriteEligible(options)) {
    const writeResult = await tryExecuteRestNativeWrite<T>(options);
    if (writeResult !== null) return writeResult;
  }

  if (!bridgeEnabled) {
    if (isWriteOperation(options.operation)) {
      reportSilentEmpty({
        reason: 'write_bridge_off',
        table: options.table,
        operation: options.operation,
      });
      recordCall(false, null, 'write_bridge_off');
      recordKillSwitchHit({
        switch_name: KILL_SWITCH_NAME,
        operation: telemetryOp,
        target: options.table,
      });
      throw new WriteUnavailableError(options.table, options.operation);
    } else if (!isRestNativeEligible(options)) {
      reportSilentEmpty({
        reason: 'table_not_whitelisted',
        table: options.table,
        operation: options.operation,
      });
      recordCall(false, null, 'table_not_whitelisted');
      recordKillSwitchHit({
        switch_name: KILL_SWITCH_NAME,
        operation: telemetryOp,
        target: options.table,
      });
    }
    return { records: [], count: 0 };
  }

  // Bridge path (rollback only — bridge is permanently OFF in production).
  try {
    const response = await invokeBridge<InvokeResult<T> | T>(
      options as unknown as Record<string, unknown>,
    );
    const payload = response.data;
    let out: InvokeResult<T>;
    if (
      options.operation !== 'select' &&
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      !('records' in payload)
    ) {
      out = { records: [payload as T], count: 1 };
    } else {
      out = payload as InvokeResult<T>;
    }
    recordCall(true, out);
    return out;
  } catch (err) {
    if (err instanceof KillSwitchActiveError) {
      recordCall(false, null, 'kill_switch_active');
      if (isWriteOperation(options.operation)) {
        throw new WriteUnavailableError(options.table, options.operation);
      }
      return { records: [], count: 0 };
    }
    if (err instanceof Error && isCorsOrNetworkBridgeError(err.message)) {
      recordCall(false, null, err.message);
      if (isWriteOperation(options.operation)) {
        throw new WriteUnavailableError(options.table, options.operation);
      }
      logger.debug(
        `[external-db] Bridge CORS/network error for ${options.table} — returning empty.`,
      );
      return { records: [], count: 0 };
    }
    recordCall(false, null, toErrorMessage(err));
    throw err;
  }
}

export async function invokeExternalDbSingle<T>(options: InvokeOptions): Promise<T> {
  const result = await invokeExternalDb<T>(options);
  if (!result.records?.length) throw new Error('Nenhum registro retornado');
  return result.records[0];
}

export async function invokeExternalDbDelete(table: string, id: string): Promise<void> {
  if (isRestNativeWriteEligible({ table, operation: 'delete', id })) {
    await tryExecuteRestNativeWrite({ table, operation: 'delete', id });
    return;
  }
  try {
    await invokeBridge<{ success: boolean; deleted_id: string }>({
      table,
      operation: 'delete',
      id,
    });
  } catch (err) {
    if (err instanceof KillSwitchActiveError) {
      logger.warn(
        `[external-db] Delete blocked by kill-switch for ${table}/${id} — surfacing loud`,
      );
      throw new WriteUnavailableError(table, 'delete');
    }
    if (err instanceof Error && isCorsOrNetworkBridgeError(err.message)) {
      logger.warn(`[external-db] Delete CORS error for ${table}/${id} — surfacing loud`);
      throw new WriteUnavailableError(table, 'delete');
    }
    throw err;
  }
}
