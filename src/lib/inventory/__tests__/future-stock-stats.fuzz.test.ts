/**
 * Fuzz — invariantes de agregação de "Estoque Futuro".
 *
 * 500 simulações pseudo-aleatórias (PRNG determinístico) validando que
 * `computeFutureStockStats` nunca dobra contagem por SKU×fornecedor nem
 * por linhas duplicadas.
 *
 * Cenários injetados:
 *   - duplicatas exatas (mesmo `id`) — devem ser deduplicadas
 *   - `expectedQuantity` negativo / NaN / Infinity — viram 0
 *   - status desconhecido — entra em `totalEntries` mas não em bucket
 *   - datas no passado — contabilizam `overdueCount`
 */
import { describe, it, expect } from 'vitest';
import {
  computeFutureStockStats,
  dedupeFutureEntries,
} from '@/lib/inventory/future-stock-stats';
import type { FutureStockEntry } from '@/types/stock';

const STATUSES: FutureStockEntry['status'][] = [
  'pending',
  'confirmed',
  'in_transit',
  'partial',
  'completed',
  'cancelled',
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeEntry(rand: () => number, idx: number): FutureStockEntry {
  const status =
    rand() < 0.05
      ? ('weird' as unknown as FutureStockEntry['status']) // status desconhecido
      : STATUSES[Math.floor(rand() * STATUSES.length)];
  const qtyRoll = rand();
  let expectedQuantity: number;
  if (qtyRoll < 0.05) expectedQuantity = -Math.floor(rand() * 100); // negativo
  else if (qtyRoll < 0.07) expectedQuantity = Number.NaN;
  else if (qtyRoll < 0.09) expectedQuantity = Number.POSITIVE_INFINITY;
  else expectedQuantity = Math.floor(rand() * 1000);
  const dayOffset = Math.floor(rand() * 120) - 30; // -30..89
  const date = new Date(Date.now() + dayOffset * 86_400_000).toISOString();
  return {
    id: `e-${idx}`,
    productId: `p-${Math.floor(rand() * 20)}`,
    expectedQuantity,
    expectedDate: date,
    source: 'purchase_order',
    status,
    supplierId: `s-${Math.floor(rand() * 5)}`,
    createdAt: date,
    updatedAt: date,
  };
}

describe('computeFutureStockStats — fuzz 500x', () => {
  it('respeita invariantes I1–I6 em todas as simulações', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const rand = mulberry32(seed * 9973);
      const n = Math.floor(rand() * 80) + 1;
      const entries: FutureStockEntry[] = [];
      for (let i = 0; i < n; i++) entries.push(makeEntry(rand, i));
      // Injeta duplicatas em ~30% dos casos (mesmo id repetido).
      if (rand() < 0.3 && entries.length > 0) {
        const dup = entries[0];
        entries.push({ ...dup });
        entries.push({ ...dup, expectedQuantity: 9_999_999 }); // tentativa de inflar
      }

      const stats = computeFutureStockStats(entries);
      const unique = dedupeFutureEntries(entries);

      // I1 — dedupe por id
      expect(stats.totalEntries, `seed=${seed} I1`).toBe(unique.length);

      // I2 — soma por status fecha com totalUnits
      //    (status desconhecido entra em totalUnits, mas não em bucket;
      //     subtraímos as quantidades dos "weird" para o check.)
      const weirdUnits = unique
        .filter((e) => !STATUSES.includes(e.status))
        .reduce((s, e) => {
          const q = e.expectedQuantity;
          if (typeof q !== 'number' || !Number.isFinite(q) || q < 0) return s;
          return s + q;
        }, 0);
      const sumBuckets =
        stats.confirmedUnits +
        stats.inTransitUnits +
        stats.pendingUnits +
        stats.partialUnits +
        stats.completedUnits +
        stats.cancelledUnits;
      expect(sumBuckets + weirdUnits, `seed=${seed} I2`).toBe(stats.totalUnits);

      // I3 — uniqueProducts <= totalEntries
      expect(stats.uniqueProducts, `seed=${seed} I3`).toBeLessThanOrEqual(stats.totalEntries);

      // I4 — overdueCount <= totalEntries
      expect(stats.overdueCount, `seed=${seed} I4`).toBeLessThanOrEqual(stats.totalEntries);

      // I5 — totalUnits >= 0 e finito
      expect(Number.isFinite(stats.totalUnits), `seed=${seed} I5 finite`).toBe(true);
      expect(stats.totalUnits, `seed=${seed} I5 >=0`).toBeGreaterThanOrEqual(0);

      // I6 — nextDate é a menor expectedDate (ou null)
      if (unique.length === 0) {
        expect(stats.nextDate, `seed=${seed} I6 vazio`).toBeNull();
      } else {
        const min = unique.reduce(
          (m, e) => (e.expectedDate < m ? e.expectedDate : m),
          unique[0].expectedDate,
        );
        expect(stats.nextDate, `seed=${seed} I6 min`).toBe(min);
      }
    }
  });

  it('duplicata exata não dobra totalUnits (regressão de dupla contagem)', () => {
    const base: FutureStockEntry = {
      id: 'dup-1',
      productId: 'p1',
      expectedQuantity: 100,
      expectedDate: '2026-12-01T00:00:00.000Z',
      source: 'purchase_order',
      status: 'confirmed',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    const stats = computeFutureStockStats([base, { ...base }, { ...base, expectedQuantity: 999 }]);
    expect(stats.totalEntries).toBe(1);
    expect(stats.totalUnits).toBe(100);
    expect(stats.confirmedUnits).toBe(100);
  });
});
