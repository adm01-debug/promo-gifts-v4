import { describe, it, expect } from 'vitest';
import { computeRuptureRisk, DEFAULT_RUPTURE_HORIZON } from '@/lib/inventory/rupture-risk';

describe('computeRuptureRisk — exemplo canônico do PO', () => {
  it('alvo=500, current=800, avg=120/d, horizon=3d → atRisk', () => {
    const r = computeRuptureRisk({
      current: 800,
      avgDailyDepletion: 120,
      targetQty: 500,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(440); // 800 − 360
    expect(r.atRisk).toBe(true);
    expect(r.daysToTarget).toBe(2); // floor((800-500)/120)
  });

  it('avg menor → projeção acima do alvo → sem risco', () => {
    const r = computeRuptureRisk({
      current: 800,
      avgDailyDepletion: 50,
      targetQty: 500,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(650);
    expect(r.atRisk).toBe(false);
  });

  it('horizonte maior amplia risco', () => {
    const base = { current: 800, avgDailyDepletion: 50, targetQty: 500 } as const;
    expect(computeRuptureRisk({ ...base, horizonDays: 3 }).atRisk).toBe(false);
    expect(computeRuptureRisk({ ...base, horizonDays: 7 }).atRisk).toBe(true);
  });
});

describe('computeRuptureRisk — pré-condições e degenerados', () => {
  const base = { current: 800, avgDailyDepletion: 120, targetQty: 500, horizonDays: 3 } as const;

  it.each([-1, NaN, Infinity, -Infinity])('current inválido (%s) → não aplica', (current) => {
    const r = computeRuptureRisk({ ...base, current });
    expect(r.atRisk).toBe(false);
    expect(r.projectedStock).toBeNull();
  });

  it('current === 0 (SKU esgotada) → risco máximo independente de alvo/média', () => {
    const r = computeRuptureRisk({
      current: 0,
      avgDailyDepletion: null,
      targetQty: null,
      horizonDays: 3,
    });
    expect(r.atRisk).toBe(true);
    expect(r.projectedStock).toBe(0);
    expect(r.daysToTarget).toBe(0);
  });

  it.each([0, -5, NaN, Infinity, null, undefined])('avgDailyDepletion inválido → não aplica', (v) => {
    const r = computeRuptureRisk({ ...base, avgDailyDepletion: v as number });
    expect(r.atRisk).toBe(false);
    expect(r.projectedStock).toBeNull();
  });

  it.each([0, -10, NaN, null, undefined])('targetQty inválido → não aplica', (v) => {
    const r = computeRuptureRisk({ ...base, targetQty: v as number });
    expect(r.atRisk).toBe(false);
  });

  it('horizon inválido → não aplica', () => {
    expect(computeRuptureRisk({ ...base, horizonDays: 0 }).atRisk).toBe(false);
    expect(computeRuptureRisk({ ...base, horizonDays: -3 }).atRisk).toBe(false);
  });

  it('projectedStock nunca é negativo (cap em 0)', () => {
    const r = computeRuptureRisk({
      current: 100,
      avgDailyDepletion: 200,
      targetQty: 50,
      horizonDays: 3,
    });
    expect(r.projectedStock).toBe(0);
    expect(r.atRisk).toBe(true);
  });

  it('default horizon = 3 dias', () => {
    expect(DEFAULT_RUPTURE_HORIZON).toBe(3);
  });
});
