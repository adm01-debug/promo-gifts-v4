/**
 * invokeTelemetrySink — Onda 21
 * ----------------------------------------------------------------
 * Ring buffer in-memory (client-side) que agrega os eventos emitidos
 * pelo wrapper SSOT `invokeEdgeSafe` (`edge.invoke`). Serve o painel
 * "Edge Invokes (live)" em `/admin/telemetria` SEM depender da RPC
 * `get_edge_invoke_summary` (REGRA #1 — RPC ainda em draft).
 *
 * Contratos:
 *  - Buffer com cap `MAX_EVENTS` (default 500). FIFO. Sem PII.
 *  - `record(event)` é síncrono, nunca lança.
 *  - `subscribe(fn)` para reatividade (React `useSyncExternalStore`).
 *  - `aggregate(nowMs, windowMs)` retorna resumo por fn.
 *
 * Todos os eventos vivem apenas em memória — nada persiste em
 * localStorage/IndexedDB (evita crescimento e vazamento cross-user).
 */

export type InvokeEventKind = 'breaker_open' | 'failed' | 'ok' | 'start';

export interface InvokeEvent {
  ts: number;
  kind: InvokeEventKind;
  fn: string;
  requestId: string;
  latencyMs?: number;
  errorKind?: string;
  attempts?: number;
}

export interface InvokeFnSummary {
  fn: string;
  total: number;
  ok: number;
  failed: number;
  breakerOpen: number;
  errorRatio: number;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  lastSeenAt: number | null;
}

export interface InvokeGlobalSummary {
  windowMs: number;
  totalStart: number;
  totalOk: number;
  totalFailed: number;
  totalBreakerOpen: number;
  errorRatio: number;
  fns: InvokeFnSummary[];
}

const MAX_EVENTS = 500;
const buffer: InvokeEvent[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* isolado */
    }
  }
}

export function recordInvokeEvent(ev: InvokeEvent): void {
  try {
    buffer.push(ev);
    if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
    notify();
  } catch {
    /* nunca lança */
  }
}

export function subscribeInvokeSink(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getInvokeEventsSnapshot(): readonly InvokeEvent[] {
  return buffer.slice();
}

export function clearInvokeSink(): void {
  buffer.length = 0;
  notify();
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

export function aggregateInvokeEvents(
  events: readonly InvokeEvent[],
  nowMs: number,
  windowMs: number,
): InvokeGlobalSummary {
  const cutoff = nowMs - windowMs;
  const perFn = new Map<
    string,
    {
      total: number;
      ok: number;
      failed: number;
      breakerOpen: number;
      latencies: number[];
      lastSeen: number;
    }
  >();
  let totalStart = 0;
  let totalOk = 0;
  let totalFailed = 0;
  let totalBreakerOpen = 0;

  for (const ev of events) {
    if (ev.ts < cutoff) continue;
    const agg = perFn.get(ev.fn) ?? {
      total: 0,
      ok: 0,
      failed: 0,
      breakerOpen: 0,
      latencies: [] as number[],
      lastSeen: 0,
    };
    if (ev.kind === 'start') {
      agg.total += 1;
      totalStart += 1;
    } else if (ev.kind === 'ok') {
      agg.ok += 1;
      totalOk += 1;
      if (typeof ev.latencyMs === 'number') agg.latencies.push(ev.latencyMs);
    } else if (ev.kind === 'failed') {
      agg.failed += 1;
      totalFailed += 1;
      if (typeof ev.latencyMs === 'number') agg.latencies.push(ev.latencyMs);
    } else if (ev.kind === 'breaker_open') {
      agg.breakerOpen += 1;
      totalBreakerOpen += 1;
    }
    if (ev.ts > agg.lastSeen) agg.lastSeen = ev.ts;
    perFn.set(ev.fn, agg);
  }

  const fns: InvokeFnSummary[] = [];
  for (const [fn, a] of perFn) {
    const sorted = a.latencies.slice().sort((x, y) => x - y);
    const settled = a.ok + a.failed;
    fns.push({
      fn,
      total: a.total,
      ok: a.ok,
      failed: a.failed,
      breakerOpen: a.breakerOpen,
      errorRatio: settled > 0 ? a.failed / settled : 0,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      lastSeenAt: a.lastSeen || null,
    });
  }
  fns.sort((a, b) => b.total - a.total || b.failed - a.failed);

  const settledTotal = totalOk + totalFailed;
  return {
    windowMs,
    totalStart,
    totalOk,
    totalFailed,
    totalBreakerOpen,
    errorRatio: settledTotal > 0 ? totalFailed / settledTotal : 0,
    fns,
  };
}
