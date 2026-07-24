/**
 * Telemetria client-side em memória para chamadas às edge functions de bridge
 * (external-db-bridge e crm-db-bridge).
 *
 * - Sem persistência: zera ao recarregar a página.
 * - Sem custo de backend: apenas observa as chamadas que já ocorrem.
 * - Buffer circular curto (últimas N chamadas) para evitar crescimento ilimitado.
 *
 * Consumido pelo card "Bridges (ao vivo)" em /admin/telemetria.
 */

import { isInstrumentationPaused } from './instrumentationControl';

export type BridgeName = 'crm-db-bridge' | 'external-db-bridge';

/** Operações permitidas para cada bridge, garantindo consistência em compile-time. */
export type BridgeOperation =
  | 'batch'
  | 'delete'
  | 'handshake'
  | 'health'
  | 'insert'
  | 'invoke'
  | 'rpc'
  | 'search'
  | 'select'
  | 'update'
  | 'upsert'
  | `auth:${string}`
  | `rpc:${string}`;

export interface BridgeCallSample {
  id: number;
  /** Timestamp wall-clock (Date.now()). */
  ts: number;
  bridge: BridgeName;
  /** Operação lógica. */
  op: BridgeOperation;
  /** Tabela, RPC ou entidade alvo. */
  target?: string;
  durationMs: number;
  /** Tamanho estimado do request em bytes. */
  reqBytes: number;
  /** Tamanho estimado do response em bytes. */
  respBytes: number;
  /** Indica se a chamada foi completada com sucesso (status 2xx). */
  ok: boolean;
  /** HTTP Status Code se disponível. */
  status?: number;
  /** Mensagem de erro amigável ou técnica. */
  errorMessage?: string;
  /** Correlation-id propagado via X-Request-Id (UUID v4). */
  requestId?: string;
  /** Echo do request-id devolvido pelo servidor. */
  serverRequestId?: string;
}

const MAX_SAMPLES = 500;

let nextId = 1;
const samples: BridgeCallSample[] = [];
let snapshot: readonly BridgeCallSample[] = [];
const listeners = new Set<() => void>();

// Throttle de notificações: agrupa rajadas em uma janela curta para evitar
// re-renders por amostra durante navegação (até dezenas de calls/s em paralelo).
// Telemetria continua "ao vivo" mas com no máximo ~10 atualizações/s.
const EMIT_THROTTLE_MS = 100;
let emitScheduled = false;

function emit() {
  if (listeners.size === 0) return; // sem subscribers ⇒ custo zero (caso comum)
  if (emitScheduled) return;
  emitScheduled = true;
  const flush = () => {
    emitScheduled = false;
    for (const l of listeners) {
      try {
        l();
      } catch {
        /* noop */
      }
    }
  };
  // setTimeout em vez de requestAnimationFrame: funciona em abas em background
  // e em ambientes não-DOM (testes). 100ms é imperceptível para "tempo real".
  setTimeout(flush, EMIT_THROTTLE_MS);
}

/**
 * Estimativa ULTRA-RÁPIDA do tamanho serializado de um payload.
 *
 * Evita JSON.stringify() em objetos grandes para não bloquear a Main Thread.
 */
export function estimatePayloadBytes(value: unknown): number {
  if (value === null) return 0;
  if (isInstrumentationPaused()) return 0;

  try {
    const type = typeof value;
    if (type === 'string') return (value as string).length;
    if (type === 'number') return 8;
    if (type === 'boolean') return 4;

    // Heurística para arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return 2;
      const sampleCount = Math.min(value.length, 5);
      let sampleBytes = 0;
      for (let i = 0; i < sampleCount; i++) {
        sampleBytes += estimatePayloadBytes(value[i]);
      }
      return Math.round((sampleBytes / sampleCount) * value.length) + value.length * 2;
    }

    // Heurística para objetos
    if (type === 'object') {
      const keys = Object.keys(value as object);
      if (keys.length === 0) return 2;

      const obj = value as Record<string, unknown>;
      const records = (obj.data as Record<string, unknown>)?.records || obj.records;
      if (Array.isArray(records)) {
        return estimatePayloadBytes(records) + 64;
      }

      const sampleCount = Math.min(keys.length, 5);
      let sampleBytes = 0;
      for (let i = 0; i < sampleCount; i++) {
        const key = keys[i];
        sampleBytes += key.length + estimatePayloadBytes(obj[key]) + 4;
      }
      return Math.round((sampleBytes / sampleCount) * keys.length) + 16;
    }
  } catch {
    return 0;
  }
  return 0;
}

export function recordBridgeCall(
  sample: Omit<BridgeCallSample, 'id' | 'ts'> & { ts?: number },
): void {
  // Kill-switch global — descarta sem alocar/notificar.
  if (isInstrumentationPaused()) return;
  const entry: BridgeCallSample = {
    id: nextId++,
    ts: sample.ts ?? Date.now(),
    bridge: sample.bridge,
    op: sample.op,
    target: sample.target,
    durationMs: Math.max(0, Math.round(sample.durationMs)),
    reqBytes: Math.max(0, sample.reqBytes | 0),
    respBytes: Math.max(0, sample.respBytes | 0),
    ok: sample.ok,
    status: sample.status,
    errorMessage: sample.errorMessage,
    requestId: sample.requestId,
    serverRequestId: sample.serverRequestId,
  };
  samples.push(entry);
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  snapshot = [...samples];
  emit();
}

export function getBridgeSamples(): readonly BridgeCallSample[] {
  return snapshot;
}

export function subscribeBridgeCalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearBridgeSamples(): void {
  samples.length = 0;
  snapshot = [];
  emit();
}

// ---------- Agregações ----------

export interface BridgeAggregateRow {
  key: string;
  bridge: BridgeName;
  op: string;
  count: number;
  errors: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  totalReqBytes: number;
  totalRespBytes: number;
  avgReqBytes: number;
  avgRespBytes: number;
  lastTs: number;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

export function aggregateByEndpoint(input: readonly BridgeCallSample[]): BridgeAggregateRow[] {
  const groups = new Map<string, BridgeCallSample[]>();
  for (const s of input) {
    const key = `${s.bridge}::${s.op}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const rows: BridgeAggregateRow[] = [];
  for (const [key, arr] of groups.entries()) {
    const durations = arr.map((s) => s.durationMs).sort((a, b) => a - b);
    const sumDur = durations.reduce((a, b) => a + b, 0);
    const errors = arr.reduce((acc, s) => acc + (s.ok ? 0 : 1), 0);
    const totalReq = arr.reduce((acc, s) => acc + s.reqBytes, 0);
    const totalResp = arr.reduce((acc, s) => acc + s.respBytes, 0);
    const lastTs = arr.reduce((acc, s) => Math.max(acc, s.ts), 0);
    rows.push({
      key,
      bridge: arr[0].bridge,
      op: arr[0].op,
      count: arr.length,
      errors,
      avgMs: Math.round(sumDur / arr.length),
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      maxMs: durations[durations.length - 1] ?? 0,
      totalReqBytes: totalReq,
      totalRespBytes: totalResp,
      avgReqBytes: Math.round(totalReq / arr.length),
      avgRespBytes: Math.round(totalResp / arr.length),
      lastTs,
    });
  }

  rows.sort((a, b) => b.count - a.count);
  return rows;
}
