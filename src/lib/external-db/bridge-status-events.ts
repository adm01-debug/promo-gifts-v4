/**
 * Bridge status event bus — STUBBED (bridge decommissioned 2026-05-30).
 *
 * The external-db-bridge is permanently OFF (kill-switch enabled=false, rollout=100%).
 * No events are ever emitted. These stubs keep all export signatures intact so that
 * error-reporter.ts and invoke.ts compile without changes.
 *
 * Phase 4B (2026-06-01): replaced live event bus with no-op stubs.
 * Phase 4A (2026-05-31): removed all UI consumers (BridgeStatusBanner, etc.).
 */

// ── Types (preserved for compatibility) ──────────────────────────────────────
export type BridgeStatusType = 'degraded' | 'recovered' | 'unavailable';

export interface BridgeStatusEventBase {
  type: BridgeStatusType;
  ts: number;
}

export interface BridgeDegradedEvent extends BridgeStatusEventBase {
  type: 'degraded';
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  baseDelayMs?: number;
  jitterMs?: number;
  reason: string;
}

export interface BridgeUnavailableEvent extends BridgeStatusEventBase {
  type: 'unavailable';
  reason: string;
  attempts: number;
}

export interface BridgeRecoveredEvent extends BridgeStatusEventBase {
  type: 'recovered';
}

export type BridgeStatusEvent = BridgeDegradedEvent | BridgeRecoveredEvent | BridgeUnavailableEvent;

type BridgeStatusEventInput = BridgeStatusEvent extends infer Event
  ? Event extends BridgeStatusEvent
    ? Omit<Event, 'ts'> & { ts?: number }
    : never
  : never;

// ── Stubs — no-ops, bridge is permanently OFF ─────────────────────────────────

/** @deprecated No-op — bridge decommissioned 2026-05-30. */
export function onBridgeStatus(_fn: (e: BridgeStatusEvent) => void): () => void {
  return () => {};
}

/** @deprecated No-op — bridge decommissioned 2026-05-30. */
export function emitBridgeStatus(_e: BridgeStatusEventInput): void {
  // no-op: bridge is permanently OFF, events are never emitted.
}

/**
 * Returns false — bridge is permanently OFF so cold-start signals never occur.
 * Preserved because error-reporter.ts uses this to classify transient errors;
 * it still matches patterns from other edge functions (crm-db-bridge, etc.).
 */
export function isColdStartSignal(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('supabase_edge_runtime_error') ||
    lower.includes('service is temporarily unavailable') ||
    lower.includes('boot_error') ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('504') ||
    lower.includes('bad gateway') ||
    lower.includes('function failed to start')
  );
}
