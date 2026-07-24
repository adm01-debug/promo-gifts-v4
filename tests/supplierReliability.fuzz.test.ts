/**
 * Fuzz / property tests: 200+ cenários gerados pseudo-aleatoriamente com seed fixa.
 *
 * Garante INVARIANTES do pipeline extract → match → score:
 *   1. count(matches) + count(orphanArrivals) === count(arrivals_válidas)
 *   2. count(matches) + count(unmatched) === count(promessas_válidas)
 *   3. nenhuma promessa é consumida mais de 1 vez
 *   4. score ∈ [0,100] ou null
 *   5. determinismo: mesmo input → mesmo output
 *   6. todo delayDays está em [-window, +window]
 *   7. todo fulfillmentRatio em [0, 1]
 */
import { describe, expect, it } from 'vitest';
import { aggregateReliability } from '@/lib/inventory/supplier-reliability/aggregate';
import {
  extractArrivals,
  extractPromises,
  type SnapshotRow,
  type SourceRow,
} from '@/lib/inventory/supplier-reliability/extract';
import { matchReplenishments } from '@/lib/inventory/supplier-reliability/matching';
import { DEFAULT_RELIABILITY_CONFIG } from '@/lib/inventory/supplier-reliability/types';

// PRNG determinístico (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDate(daysFromBase: number, baseMs: number): string {
  return new Date(baseMs + daysFromBase * 86_400_000).toISOString().slice(0, 10);
}
function isoTs(daysFromBase: number, baseMs: number): string {
  return new Date(baseMs + daysFromBase * 86_400_000).toISOString();
}

interface Scenario {
  sources: SourceRow[];
  snapshots: SnapshotRow[];
  suppliers: Array<{ id: string; name: string }>;
}

function genScenario(seed: number): Scenario {
  const rnd = mulberry32(seed);
  const baseMs = Date.UTC(2026, 0, 1); // 2026-01-01
  const supplierCount = 1 + Math.floor(rnd() * 4);
  const suppliers = Array.from({ length: supplierCount }, (_, i) => ({
    id: `sup-${i}`,
    name: `Fornecedor ${i}`,
  }));
  const sourceCount = 1 + Math.floor(rnd() * 8);
  const sources: SourceRow[] = [];
  const snapshots: SnapshotRow[] = [];
  let snapId = 0;
  for (let i = 0; i < sourceCount; i++) {
    const supId = suppliers[Math.floor(rnd() * suppliers.length)].id;
    const sourceId = `src-${i}`;
    const variantId = `var-${i % 5}`;
    // até 6 promessas
    const slotData: Record<string, number | string | null> = {};
    for (let s = 1; s <= 6; s++) {
      const hasSlot = rnd() < 0.55;
      slotData[`next_quantity_${s}`] = hasSlot ? Math.floor(rnd() * 5000) + 10 : null;
      slotData[`next_date_${s}`] = hasSlot
        ? isoDate(Math.floor(rnd() * 200) - 50, baseMs) // -50..+150
        : null;
    }
    sources.push({
      id: sourceId,
      variant_id: variantId,
      supplier_id: supId,
      updated_at: isoTs(0, baseMs),
      next_quantity_1: slotData.next_quantity_1 as number | null,
      next_date_1: slotData.next_date_1 as string | null,
      next_quantity_2: slotData.next_quantity_2 as number | null,
      next_date_2: slotData.next_date_2 as string | null,
      next_quantity_3: slotData.next_quantity_3 as number | null,
      next_date_3: slotData.next_date_3 as string | null,
      next_quantity_4: slotData.next_quantity_4 as number | null,
      next_date_4: slotData.next_date_4 as string | null,
      next_quantity_5: slotData.next_quantity_5 as number | null,
      next_date_5: slotData.next_date_5 as string | null,
      next_quantity_6: slotData.next_quantity_6 as number | null,
      next_date_6: slotData.next_date_6 as string | null,
    });
    // chegadas (0..4 por source)
    const arrivalCount = Math.floor(rnd() * 5);
    let currentStock = 0;
    for (let a = 0; a < arrivalCount; a++) {
      const dayOffset = Math.floor(rnd() * 200) - 30;
      const delta = Math.floor(rnd() * 5000) + 1;
      const isPriceOnly = rnd() < 0.1;
      const isNegative = rnd() < 0.1;
      const newStock = isNegative ? Math.max(0, currentStock - delta) : currentStock + delta;
      snapshots.push({
        id: `snap-${snapId++}`,
        variant_supplier_source_id: sourceId,
        supplier_id: supId,
        variant_id: variantId,
        stock_main_old: currentStock,
        stock_main_new: newStock,
        stock_other_old: 0,
        stock_other_new: 0,
        change_type: isPriceOnly ? 'price' : 'stock',
        captured_at: isoTs(dayOffset, baseMs),
      });
      currentStock = newStock;
    }
    // 5% de ruído: source órfã (sem supplier)
    if (rnd() < 0.05) sources.push({ ...sources[sources.length - 1], id: `src-bad-${i}`, supplier_id: null });
  }
  return { sources, snapshots, suppliers };
}

describe('Reliability pipeline — 200+ cenários fuzz', () => {
  const cfg = DEFAULT_RELIABILITY_CONFIG;

  for (let seed = 1; seed <= 200; seed++) {
    it(`cenário #${seed} respeita todas as invariantes`, () => {
      const sc = genScenario(seed);
      const promises = extractPromises(sc.sources);
      const arrivals = extractArrivals(sc.snapshots);
      const r = matchReplenishments(promises, arrivals);

      // INV 1: arrivals válidas = matches + orphans
      expect(r.matches.length + r.orphanArrivals.length).toBe(arrivals.length);

      // INV 2: promessas válidas = matches + unmatched
      expect(r.matches.length + r.unmatchedPromises.length).toBe(promises.length);

      // INV 3: nenhuma promessa consumida 2x
      const consumed = r.matches.map((m) => m.promise.id);
      expect(new Set(consumed).size).toBe(consumed.length);

      // INV 6: delay dentro da janela
      for (const m of r.matches) {
        expect(Math.abs(m.delayDays)).toBeLessThanOrEqual(cfg.matchWindowDays);
        expect(m.fulfillmentRatio).toBeGreaterThanOrEqual(0);
        expect(m.fulfillmentRatio).toBeLessThanOrEqual(1);
      }

      // INV 5: determinismo
      const r2 = matchReplenishments([...promises].reverse(), [...arrivals].reverse());
      expect(r2.matches.length).toBe(r.matches.length);
      expect(r2.orphanArrivals.length).toBe(r.orphanArrivals.length);

      // Agregação não quebra e respeita INV 4
      const agg = aggregateReliability({
        promises,
        arrivals,
        suppliers: sc.suppliers,
        now: new Date(Date.UTC(2026, 6, 1)),
      });
      for (const s of agg.bySupplier) {
        if (s.overall.score !== null) {
          expect(s.overall.score).toBeGreaterThanOrEqual(0);
          expect(s.overall.score).toBeLessThanOrEqual(100);
        }
        expect(s.matchedCount).toBeLessThanOrEqual(s.totalArrivals);
        expect(s.matchedCount).toBeLessThanOrEqual(s.totalPromises);
      }
    });
  }
});
