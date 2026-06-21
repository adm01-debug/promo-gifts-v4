/**
 * Long-task watchdog (preview/dev).
 *
 * Usa PerformanceObserver('longtask') para detectar bloqueios da main thread
 * (≥50ms por especificação) e correlaciona cada long task com as chamadas de
 * bridge cuja janela de execução [ts-durationMs, ts] cobre o instante do
 * bloqueio. Isso aponta — com alta probabilidade — qual chamada concreta
 * (ex: `select·products`) provocou o jank.
 *
 * Detalhes importantes:
 *  - longtask.startTime/duration são em performance.now() (origem do
 *    timeOrigin). BridgeCallSample.ts é Date.now() — convertemos via
 *    `performance.timeOrigin` para ficarem na mesma escala.
 *  - Não bloqueia: tudo é callback assíncrono. Se PerformanceObserver não
 *    suportar 'longtask' (Safari antigo) o watchdog fica inerte.
 *  - Buffer circular curto para não vazar memória.
 *  - Custo zero quando não há listeners (exatamente como bridgeCallMetrics).
 */
import { getBridgeSamples, type BridgeCallSample } from './bridgeCallMetrics';
import { isInstrumentationPaused, subscribeInstrumentationPaused } from './instrumentationControl';

/** Causa provável do bloqueio da main thread. */
export type LongTaskAttribution = string | 'other' | 'same-origin-ancestor' | 'self';

export interface LongTaskEvent {
  /** Identificador sequencial único na sessão. */
  id: number;
  /** ms desde timeOrigin (escala performance.now()). */
  startTime: number;
  /** Duração total do bloqueio em ms. */
  durationMs: number;
  /** Date.now() equivalente do INÍCIO da task. */
  startedAtWallMs: number;
  /** Atribuição reportada pelo browser. */
  attribution: LongTaskAttribution[];
  /** Chamadas de bridge que estavam ativas durante TODO ou PARTE do bloqueio. */
  overlappingCalls: readonly BridgeCallSample[];
  /** Chamadas de bridge que terminaram imediatamente antes (janela de cooldown). */
  recentlyCompletedCalls: readonly BridgeCallSample[];
}

const MAX_EVENTS = 100;
/** Tasks abaixo disso são ruído (animações, layout normais). */
const MIN_DURATION_MS = 80;
/** Janela "recente" considerada após o término (ms). */
const RECENT_COMPLETION_WINDOW_MS = 50;

const events: LongTaskEvent[] = [];
const listeners = new Set<() => void>();
let nextId = 1;
let observer: PerformanceObserver | null = null;
let started = false;

function emit() {
  if (listeners.size === 0) return;
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* noop */
    }
  }
}

function correlate(
  startWall: number,
  endWall: number,
): {
  overlapping: BridgeCallSample[];
  recent: BridgeCallSample[];
} {
  // Vasculha apenas a cauda recente do buffer — muito mais rápido que filtrar tudo.
  const all = getBridgeSamples();
  const tail = all.slice(-80);
  const overlapping: BridgeCallSample[] = [];
  const recent: BridgeCallSample[] = [];
  for (const s of tail) {
    const sStart = s.ts - s.durationMs;
    const sEnd = s.ts;
    // overlap: a janela da call cruza a janela da long task
    if (sStart <= endWall && sEnd >= startWall) {
      overlapping.push(s);
    } else if (sEnd >= startWall - RECENT_COMPLETION_WINDOW_MS && sEnd <= startWall) {
      // Terminou pouco antes do bloqueio → provável causa (ex: parse/setState pesado pós-resposta)
      recent.push(s);
    }
  }
  return { overlapping, recent };
}

export function startLongTaskWatchdog(): void {
  if (started) return;
  if (isInstrumentationPaused()) return; // kill-switch global
  if (typeof PerformanceObserver === 'undefined') return;
  // Feature-detect: nem todos os browsers suportam 'longtask'.
  const supported = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
    .supportedEntryTypes;
  if (supported && !supported.includes('longtask')) return;

  try {
    observer = new PerformanceObserver((list) => {
      const origin = performance.timeOrigin;
      let pushed = false;
      for (const entry of list.getEntries()) {
        if (entry.duration < MIN_DURATION_MS) continue;
        const startWall = origin + entry.startTime;
        const endWall = startWall + entry.duration;
        const { overlapping, recent } = correlate(startWall, endWall);
        const attribution =
          (
            entry as PerformanceEntry & {
              attribution?: Array<{ name?: string }>;
            }
          ).attribution?.map((a) => a.name || 'unknown') ?? [];
        events.push({
          id: nextId++,
          startTime: entry.startTime,
          durationMs: Math.round(entry.duration),
          startedAtWallMs: Math.round(startWall),
          attribution,
          overlappingCalls: overlapping,
          recentlyCompletedCalls: recent,
        });
        pushed = true;
      }
      if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
      if (pushed) emit();
    });
    observer.observe({ entryTypes: ['longtask'] });
    started = true;
  } catch {
    // observe pode falhar se o browser não aceitar entryTypes — ignora silenciosamente.
    observer = null;
  }
}

export function stopLongTaskWatchdog(): void {
  observer?.disconnect();
  observer = null;
  started = false;
}

// Auto-reage ao kill-switch global: quando pausado desconecta o observer;
// quando retomado, religa se ainda houver listeners ativos.
subscribeInstrumentationPaused(() => {
  if (isInstrumentationPaused()) {
    stopLongTaskWatchdog();
  } else if (listeners.size > 0) {
    startLongTaskWatchdog();
  }
});

export function getLongTaskEvents(): readonly LongTaskEvent[] {
  return events;
}

export function subscribeLongTasks(listener: () => void): () => void {
  listeners.add(listener);
  // Lazy start: só liga o observer quando alguém efetivamente assina.
  if (!started) startLongTaskWatchdog();
  return () => {
    listeners.delete(listener);
    // Mantemos o observer rodando mesmo sem listeners — coletar histórico
    // é barato (apenas push em array) e útil para inspeção pontual depois.
  };
}

export function clearLongTaskEvents(): void {
  events.length = 0;
  emit();
}

/** Diagnóstico textual rápido (útil em console: copiar/colar). */
export function describeLongTask(e: LongTaskEvent): string {
  const head = `⏱ longtask ${e.durationMs}ms @${new Date(e.startedAtWallMs).toISOString().slice(11, 23)}`;
  const ov = e.overlappingCalls.length
    ? ` · em voo: ${e.overlappingCalls.map((c) => `${c.bridge.split('-')[0]}:${c.op}(${c.durationMs}ms)`).join(', ')}`
    : '';
  const rc = e.recentlyCompletedCalls.length
    ? ` · acabou de chegar: ${e.recentlyCompletedCalls.map((c) => `${c.op}(${c.respBytes}B)`).join(', ')}`
    : '';
  const attr = e.attribution.length ? ` · attr=${e.attribution.join('|')}` : '';
  return head + ov + rc + attr;
}
