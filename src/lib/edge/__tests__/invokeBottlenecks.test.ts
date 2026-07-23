import { describe, it, expect } from 'vitest';
import {
  categorizeFn,
  computeBottleneckScore,
  rankBottlenecks,
  rollupByCategory,
} from '../invokeBottlenecks';
import type { InvokeGlobalSummary, InvokeFnSummary } from '../invokeTelemetrySink';

function fn(overrides: Partial<InvokeFnSummary> & { fn: string }): InvokeFnSummary {
  return {
    total: 0,
    ok: 0,
    failed: 0,
    breakerOpen: 0,
    errorRatio: 0,
    p50Ms: null,
    p95Ms: null,
    p99Ms: null,
    lastSeenAt: null,
    ...overrides,
  };
}

function summary(fns: InvokeFnSummary[]): InvokeGlobalSummary {
  const totalOk = fns.reduce((a, f) => a + f.ok, 0);
  const totalFailed = fns.reduce((a, f) => a + f.failed, 0);
  const settled = totalOk + totalFailed;
  return {
    windowMs: 60_000,
    totalStart: fns.reduce((a, f) => a + f.total, 0),
    totalOk,
    totalFailed,
    totalBreakerOpen: fns.reduce((a, f) => a + f.breakerOpen, 0),
    errorRatio: settled > 0 ? totalFailed / settled : 0,
    fns,
  };
}

describe('categorizeFn', () => {
  it.each([
    ['log-login-attempt', 'auth'],
    ['crm-db-bridge', 'crm'],
    ['magazine-publish', 'magazine'],
    ['magic-up-generate', 'magic-up'],
    ['webhook-dispatcher', 'webhook'],
    ['comparison-ai-advisor', 'comparison'],
    ['dropbox-list', 'dropbox'],
    ['visual-search', 'visual-search'],
    ['connection-tester', 'connection'],
    ['secrets-manager', 'secrets'],
    ['mcp-keys-issue', 'mcp'],
    ['quote-public-view', 'quote'],
    ['something-else', 'other'],
  ])('classifica %s → %s', (name, expected) => {
    expect(categorizeFn(name)).toBe(expected);
  });
});

describe('computeBottleneckScore', () => {
  it('endpoint estável tem score baixo', () => {
    const { score, reason } = computeBottleneckScore(
      fn({ fn: 'x', total: 10, ok: 10, p95Ms: 120 }),
    );
    expect(score).toBe(0);
    expect(reason).toBe('estável');
  });

  it('penaliza latência acima de 300ms', () => {
    const r = computeBottleneckScore(fn({ fn: 'x', total: 100, ok: 100, p95Ms: 1200 }));
    expect(r.score).toBeGreaterThan(0);
    expect(r.reason).toContain('p95 1200ms');
  });

  it('penaliza erros', () => {
    const r = computeBottleneckScore(
      fn({ fn: 'x', total: 100, ok: 50, failed: 50, errorRatio: 0.5 }),
    );
    expect(r.reason).toContain('50% erros');
    expect(r.score).toBeGreaterThan(50);
  });

  it('breaker aberto adiciona penalidade forte', () => {
    const r = computeBottleneckScore(fn({ fn: 'x', total: 5, ok: 5, breakerOpen: 3 }));
    expect(r.reason).toContain('breaker');
    expect(r.score).toBeGreaterThan(0);
  });
});

describe('rankBottlenecks', () => {
  it('ranqueia pior primeiro e respeita limit', () => {
    const rows = rankBottlenecks(
      summary([
        fn({ fn: 'fast', total: 100, ok: 100, p95Ms: 100 }),
        fn({ fn: 'slow', total: 100, ok: 100, p95Ms: 2000 }),
        fn({ fn: 'broken', total: 100, ok: 20, failed: 80, errorRatio: 0.8, p95Ms: 300 }),
      ]),
      { limit: 2 },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].fn).toBe('broken');
    expect(rows[0].category).toBe('other');
    expect(rows[0].score).toBeGreaterThan(rows[1].score);
  });

  it('inclui breaker_open mesmo sem total', () => {
    const rows = rankBottlenecks(
      summary([fn({ fn: 'crm-db-bridge', total: 0, breakerOpen: 4 })]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('crm');
  });
});

describe('rollupByCategory', () => {
  it('agrega por categoria e pega o pior p95', () => {
    const rows = rollupByCategory(
      summary([
        fn({ fn: 'magazine-publish', total: 10, ok: 8, failed: 2, errorRatio: 0.2, p95Ms: 400 }),
        fn({ fn: 'magazine-list', total: 20, ok: 20, p95Ms: 900 }),
        fn({ fn: 'crm-db-bridge', total: 5, ok: 5, p95Ms: 200 }),
      ]),
    );
    const mag = rows.find((r) => r.category === 'magazine')!;
    expect(mag.fns).toBe(2);
    expect(mag.total).toBe(30);
    expect(mag.failed).toBe(2);
    expect(mag.worstP95Ms).toBe(900);
    // magazine tem mais gargalo que crm → aparece antes
    expect(rows[0].category).toBe('magazine');
  });

  it('não gera divisão por zero quando nada foi liquidado', () => {
    const rows = rollupByCategory(summary([fn({ fn: 'x', total: 3 })]));
    expect(rows[0].errorRatio).toBe(0);
    expect(Number.isFinite(rows[0].score)).toBe(true);
  });
});
