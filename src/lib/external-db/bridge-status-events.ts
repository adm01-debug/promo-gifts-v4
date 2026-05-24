/**
 * Event bus leve para sinalizar indisponibilidade do external-db-bridge à UI.
 *
 * Disparos:
 *  - `degraded`: 1ª tentativa retornou 503/cold-start, mas o retry vai cobrir.
 *  - `unavailable`: retries esgotados; o usuário precisa saber.
 *  - `recovered`: chamada subsequente voltou a 200 após `degraded`/`unavailable`.
 *
 * Listeners (toast/banner) decidem como apresentar — este módulo só
 * publica eventos, sem dependências de UI.
 */

export type BridgeStatusType = 'degraded' | 'unavailable' | 'recovered';

export interface BridgeStatusEventBase {
  type: BridgeStatusType;
  /** Timestamp do evento para correlação em logs. */
  ts: number;
}

export interface BridgeDegradedEvent extends BridgeStatusEventBase {
  type: 'degraded';
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  /** Backoff base (sem jitter). */
  baseDelayMs?: number;
  /** Componente aleatório. */
  jitterMs?: number;
  /** Motivo amigável (ex: "Cold start detectado"). */
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

export type BridgeStatusEvent =
  | BridgeDegradedEvent
  | BridgeUnavailableEvent
  | BridgeRecoveredEvent;

type BridgeStatusEventInput = BridgeStatusEvent extends infer Event
  ? Event extends BridgeStatusEvent
    ? Omit<Event, 'ts'> & { ts?: number }
    : never
  : never;

type Listener = (e: BridgeStatusEvent) => void;
const listeners = new Set<Listener>();

export function onBridgeStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitBridgeStatus(e: BridgeStatusEventInput): void {
  const event: BridgeStatusEvent = {
    ...e,
    ts: e.ts ?? Date.now(),
  } as BridgeStatusEvent;

  for (const fn of listeners) {
    try { fn(event); } catch { /* noop */ }
  }
}

const COLD_START_PATTERNS = [
  'supabase_edge_runtime_error',
  'service is temporarily unavailable',
  'boot_error',
  '503',
  '502',
  '504',
  'bad gateway',
  'function failed to start',
];

export function isColdStartSignal(message: string): boolean {
  const lower = message.toLowerCase();
  return COLD_START_PATTERNS.some(p => lower.includes(p));
}
