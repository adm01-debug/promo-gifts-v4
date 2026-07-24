import { describe, expect, it } from 'vitest';
import { bandFromScore, computeWindow } from '@/lib/inventory/supplier-reliability/score';
import type {
  PromisedReplenishment,
  ReplenishmentMatch,
} from '@/lib/inventory/supplier-reliability/types';

function M(delayDays: number, fulfillmentRatio: number, idx = 0): ReplenishmentMatch {
  const promise: PromisedReplenishment = {
    id: `p${idx}`,
    sourceId: 's',
    supplierId: 'sup',
    variantId: 'var',
    slot: 1,
    promisedDate: '2026-07-20',
    promisedQuantity: 1000,
    observedAt: '2026-01-01T00:00:00Z',
  };
  return {
    promise,
    arrival: {
      id: `a${idx}`,
      sourceId: 's',
      supplierId: 'sup',
      variantId: 'var',
      receivedAt: '2026-07-20T00:00:00Z',
      receivedQuantity: Math.round(1000 * fulfillmentRatio),
    },
    delayDays,
    fulfillmentRatio: Math.min(1, Math.max(0, fulfillmentRatio)),
  };
}

describe('computeWindow', () => {
  it('matches vazio → null em tudo, band=unknown', () => {
    const w = computeWindow([]);
    expect(w.score).toBeNull();
    expect(w.matchedCount).toBe(0);
    expect(bandFromScore(w.score)).toBe('unknown');
  });

  it('100% pontualidade + 100% cumprimento → score 100, band=high', () => {
    const w = computeWindow([M(0, 1), M(-1, 1), M(0, 1)]);
    expect(w.score).toBe(100);
    expect(w.avgDelayDays).toBeNull();
    expect(bandFromScore(w.score)).toBe('high');
  });

  it('100% atrasados ≥14d → pontuality 0; full qty → score = 40', () => {
    const w = computeWindow([M(14, 1), M(20, 1), M(14, 1)]);
    expect(w.pontualityScore).toBe(0);
    expect(w.score).toBe(40);
    expect(bandFromScore(w.score)).toBe('low');
  });

  it('50% cumprimento + on-time → score = 60+20 = 80, band=medium', () => {
    const w = computeWindow([M(0, 0.5), M(0, 0.5)]);
    expect(w.score).toBe(80);
    expect(bandFromScore(w.score)).toBe('medium');
  });

  it('atraso de 7d (metade do limite) → pontuality 0.5', () => {
    const w = computeWindow([M(7, 1)]);
    expect(w.pontualityScore).toBeCloseTo(0.5);
    // score = 0.6*0.5 + 0.4*1 = 0.7 → 70
    expect(w.score).toBe(70);
  });

  it('avgDelayDays calcula apenas atrasos positivos', () => {
    const w = computeWindow([M(-5, 1), M(0, 1), M(2, 1), M(8, 1)]);
    expect(w.avgDelayDays).toBe(5); // (2+8)/2
  });

  it('fulfillment ratio > 1 é capado para não premiar excesso', () => {
    const w = computeWindow([{ ...M(0, 1), fulfillmentRatio: 5 }]);
    expect(w.fulfillmentScore).toBe(1);
    expect(w.score).toBe(100);
  });
});

describe('bandFromScore — limiares', () => {
  it.each([
    [100, 'high'],
    [85, 'high'],
    [84, 'medium'],
    [60, 'medium'],
    [59, 'low'],
    [0, 'low'],
    [null, 'unknown'],
  ])('score=%s → %s', (score, band) => {
    expect(bandFromScore(score as number | null)).toBe(band);
  });
});

describe('config customizada', () => {
  it('respeita pesos diferentes', () => {
    const w = computeWindow([M(0, 0)], { pontualityWeight: 1, fulfillmentWeight: 0 });
    expect(w.score).toBe(100);
  });
});
