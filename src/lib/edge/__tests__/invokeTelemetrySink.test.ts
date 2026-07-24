/**
 * invokeTelemetrySink — testes exaustivos (Onda 21).
 * Cobre: FIFO cap, subscribe/notify, agregação por fn, percentis,
 * detecção de fuzz (500 eventos aleatórios não quebram invariantes).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  aggregateInvokeEvents,
  clearInvokeSink,
  getInvokeEventsSnapshot,
  recordInvokeEvent,
  subscribeInvokeSink,
  type InvokeEvent,
  type InvokeEventKind,
} from '@/lib/edge/invokeTelemetrySink';

afterEach(() => clearInvokeSink());

const NOW = 1_700_000_000_000;

function ev(overrides: Partial<InvokeEvent> & Pick<InvokeEvent, 'fn' | 'kind'>): InvokeEvent {
  return {
    ts: NOW,
    requestId: 'req-1',
    ...overrides,
  };
}

describe('invokeTelemetrySink — buffer', () => {
  it('respeita o cap FIFO de 500 eventos', () => {
    for (let i = 0; i < 600; i++) {
      recordInvokeEvent(ev({ kind: 'start', fn: 'f', requestId: String(i), ts: NOW + i }));
    }
    const snap = getInvokeEventsSnapshot();
    expect(snap.length).toBe(500);
    expect(snap[0].requestId).toBe('100');
    expect(snap[snap.length - 1].requestId).toBe('599');
  });

  it('subscribe recebe notificações e permite unsubscribe', () => {
    let n = 0;
    const off = subscribeInvokeSink(() => (n += 1));
    recordInvokeEvent(ev({ kind: 'start', fn: 'f' }));
    recordInvokeEvent(ev({ kind: 'ok', fn: 'f', latencyMs: 12 }));
    off();
    recordInvokeEvent(ev({ kind: 'ok', fn: 'f', latencyMs: 34 }));
    expect(n).toBe(2);
  });

  it('recordInvokeEvent nunca lança mesmo com payload inválido', () => {
    expect(() =>
      recordInvokeEvent({ ts: NaN, kind: 'ok', fn: '', requestId: '' } as InvokeEvent),
    ).not.toThrow();
  });

  it('clearInvokeSink zera o buffer', () => {
    recordInvokeEvent(ev({ kind: 'start', fn: 'f' }));
    clearInvokeSink();
    expect(getInvokeEventsSnapshot().length).toBe(0);
  });
});

describe('aggregateInvokeEvents — semântica', () => {
  it('descarta eventos fora da janela', () => {
    const events: InvokeEvent[] = [
      { ts: NOW - 10_000, kind: 'start', fn: 'a', requestId: 'r1' },
      { ts: NOW - 500, kind: 'start', fn: 'a', requestId: 'r2' },
    ];
    const s = aggregateInvokeEvents(events, NOW, 1_000);
    expect(s.totalStart).toBe(1);
    expect(s.fns[0].total).toBe(1);
  });

  it('calcula p50/p95/p99 corretamente', () => {
    const events: InvokeEvent[] = Array.from({ length: 100 }, (_, i) => ({
      ts: NOW - i,
      kind: 'ok' as InvokeEventKind,
      fn: 'x',
      requestId: `r${i}`,
      latencyMs: i + 1, // 1..100
    }));
    const s = aggregateInvokeEvents(events, NOW, 60_000);
    const fn = s.fns[0];
    expect(fn.p50Ms).toBeGreaterThanOrEqual(50);
    expect(fn.p50Ms).toBeLessThanOrEqual(51);
    expect(fn.p95Ms).toBeGreaterThanOrEqual(95);
    expect(fn.p99Ms).toBeGreaterThanOrEqual(99);
  });

  it('separa ok/failed/breaker e calcula errorRatio corretamente', () => {
    const events: InvokeEvent[] = [
      { ts: NOW, kind: 'start', fn: 'y', requestId: 'r1' },
      { ts: NOW, kind: 'ok', fn: 'y', requestId: 'r1', latencyMs: 10 },
      { ts: NOW, kind: 'start', fn: 'y', requestId: 'r2' },
      { ts: NOW, kind: 'failed', fn: 'y', requestId: 'r2', latencyMs: 20, errorKind: 'server' },
      { ts: NOW, kind: 'start', fn: 'y', requestId: 'r3' },
      { ts: NOW, kind: 'breaker_open', fn: 'y', requestId: 'r3' },
    ];
    const s = aggregateInvokeEvents(events, NOW, 60_000);
    const y = s.fns.find((f) => f.fn === 'y')!;
    expect(y.total).toBe(3);
    expect(y.ok).toBe(1);
    expect(y.failed).toBe(1);
    expect(y.breakerOpen).toBe(1);
    expect(y.errorRatio).toBeCloseTo(0.5, 5);
    expect(s.errorRatio).toBeCloseTo(0.5, 5);
  });

  it('ordena fns por total desc, depois failed desc', () => {
    const events: InvokeEvent[] = [
      { ts: NOW, kind: 'start', fn: 'a', requestId: 'r1' },
      { ts: NOW, kind: 'start', fn: 'a', requestId: 'r2' },
      { ts: NOW, kind: 'start', fn: 'b', requestId: 'r3' },
    ];
    const s = aggregateInvokeEvents(events, NOW, 60_000);
    expect(s.fns[0].fn).toBe('a');
    expect(s.fns[1].fn).toBe('b');
  });

  it('fuzz — 500 eventos aleatórios mantêm invariantes', () => {
    const kinds: InvokeEventKind[] = ['start', 'ok', 'failed', 'breaker_open'];
    const events: InvokeEvent[] = Array.from({ length: 500 }, (_, i) => ({
      ts: NOW - Math.floor(Math.random() * 30_000),
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      fn: `fn_${Math.floor(Math.random() * 8)}`,
      requestId: `r${i}`,
      latencyMs: Math.floor(Math.random() * 3_000),
    }));
    const s = aggregateInvokeEvents(events, NOW, 60_000);
    // Invariantes globais:
    let sumTotal = 0;
    let sumOk = 0;
    let sumFailed = 0;
    let sumBreaker = 0;
    for (const f of s.fns) {
      expect(f.errorRatio).toBeGreaterThanOrEqual(0);
      expect(f.errorRatio).toBeLessThanOrEqual(1);
      if (f.p50Ms !== null && f.p95Ms !== null) expect(f.p95Ms).toBeGreaterThanOrEqual(f.p50Ms);
      if (f.p95Ms !== null && f.p99Ms !== null) expect(f.p99Ms).toBeGreaterThanOrEqual(f.p95Ms);
      sumTotal += f.total;
      sumOk += f.ok;
      sumFailed += f.failed;
      sumBreaker += f.breakerOpen;
    }
    expect(sumTotal).toBe(s.totalStart);
    expect(sumOk).toBe(s.totalOk);
    expect(sumFailed).toBe(s.totalFailed);
    expect(sumBreaker).toBe(s.totalBreakerOpen);
  });
});
