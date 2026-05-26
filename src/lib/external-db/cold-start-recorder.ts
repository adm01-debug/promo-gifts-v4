/**
 * Recorder em memória que escuta `bridge-status-events` e agrupa as tentativas
 * de retry em "incidentes" de cold-start, para exibir no /admin/telemetria.
 *
 * Cada incidente = sequência contígua de eventos `degraded` terminada por
 * `recovered` (sucesso) ou `unavailable` (falha definitiva). Nada persiste:
 * é uma janela leve para diagnóstico em tempo real.
 */
import { onBridgeStatus, type BridgeStatusEvent } from './bridge-status-events';

export type RetryAttempt = {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  baseDelayMs?: number;
  jitterMs?: number;
  reason: string;
  ts: number;
};

export type ColdStartIncident = {
  id: string;
  startedAt: number;
  endedAt?: number;
  outcome: 'recovered' | 'unavailable' | 'in_progress';
  attempts: RetryAttempt[];
  finalReason?: string;
};

const MAX_INCIDENTS = 25;
let incidents: ColdStartIncident[] = [];
let current: ColdStartIncident | null = null;
const listeners = new Set<() => void>();
let started = false;

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function ensureCurrent(now: number): ColdStartIncident {
  if (!current) {
    current = {
      id: `cs_${now}_${Math.random().toString(36).slice(2, 6)}`,
      startedAt: now,
      outcome: 'in_progress',
      attempts: [],
    };
  }
  return current;
}

function closeCurrent(outcome: 'recovered' | 'unavailable', now: number, reason?: string) {
  if (!current) return;
  current.outcome = outcome;
  current.endedAt = now;
  current.finalReason = reason;
  incidents = [current, ...incidents].slice(0, MAX_INCIDENTS);
  current = null;
}

function handle(e: BridgeStatusEvent) {
  const now = Date.now();
  if (e.type === 'degraded') {
    const inc = ensureCurrent(now);
    inc.attempts.push({
      attempt: e.attempt,
      maxAttempts: e.maxAttempts,
      delayMs: e.delayMs,
      baseDelayMs: e.baseDelayMs,
      jitterMs: e.jitterMs,
      reason: e.reason,
      ts: now,
    });
    notify();
    return;
  }
  if (e.type === 'recovered') {
    if (current) {
      closeCurrent('recovered', now);
      notify();
    }
    return;
  }
  if (e.type === 'unavailable') {
    ensureCurrent(now);
    closeCurrent('unavailable', now, e.reason);
    notify();
  }
}

export function startColdStartRecorder(): () => void {
  if (started) return () => undefined;
  started = true;
  return onBridgeStatus(handle);
}

export function getColdStartIncidents(): ColdStartIncident[] {
  // O incidente em progresso aparece no topo para feedback imediato.
  return current ? [current, ...incidents] : incidents;
}

export function subscribeColdStartIncidents(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function clearColdStartIncidents(): void {
  incidents = [];
  current = null;
  notify();
}
