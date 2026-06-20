/**
 * stock-filter.fuzz — Property-based / fuzz battery (500 simulações determinísticas)
 *
 * Invariantes validadas em cada simulação:
 *   1. Quando há filtro de cor, TODA variação retornada casa com a cor.
 *   2. Totais agregados batem EXATAMENTE com a soma das variações projetadas.
 *   3. minQuantityNeeded compara contra o pool das variações filtradas (não o total do produto).
 *   4. totalVariants === variants.length.
 *   5. Sem filtro de cor, variants é a referência original (sem realocação).
 *   6. Reuso do mesmo índice entre filtros não corrompe resultados (referencialmente estável).
 *   7. Idempotência: aplicar duas vezes produz mesma saída.
 *   8. Resultado contém apenas produtos do universo (sem duplicatas, sem ids estranhos).
 */
import { describe, expect, it } from 'vitest';
import {
  applyStockFilters,
  aggregateVariantTotals,
  buildStockIndexes,
  normalize,
} from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type StockStatus,
  type VariantStock,
} from '@/types/stock';

// PRNG determinístico (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['Azul', 'Vermelho', 'Verde', 'Amarelo', 'Preto', 'Branco', 'Rosa', 'Cinza'];
const STATUSES: StockStatus[] = [
  'in_stock',
  'low_stock',
  'critical',
  'out_of_stock',
  'incoming',
  'overstocked',
];

function makeVariant(rnd: () => number, productId: string, idx: number): VariantStock {
  const color = COLORS[Math.floor(rnd() * COLORS.length)];
  const status = STATUSES[Math.floor(rnd() * STATUSES.length)];
  const currentStock = status === 'out_of_stock' ? 0 : Math.floor(rnd() * 1500);
  const reservedStock = Math.min(currentStock, Math.floor(rnd() * 50));
  return {
    id: `${productId}-v${idx}`,
    productId,
    variantId: `${productId}-v${idx}`,
    variantSku: `${productId.toUpperCase()}-${color.slice(0, 3).toUpperCase()}${idx}`,
    colorName: color,
    currentStock,
    minStock: Math.floor(rnd() * 30),
    reservedStock,
    inTransitStock: status === 'incoming' ? Math.floor(rnd() * 100) + 1 : 0,
    availableStock: Math.max(0, currentStock - reservedStock),
    status,
    updatedAt: '2026-01-01',
  };
}

function makeProduct(rnd: () => number, i: number): ProductStockSummary {
  const variants = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, k) =>
    makeVariant(rnd, `p${i}`, k),
  );
  const totals = aggregateVariantTotals(variants);
  // Mirror aggregateVariantsToProduct priority exactly (post BUG-A fix)
  const vIn = variants.filter((v) => v.status === 'incoming' || v.inTransitStock > 0).length;
  const vOut = variants.filter((v) => v.status === 'out_of_stock').length;
  const vCrit = variants.filter((v) => v.status === 'critical').length;
  const vLow = variants.filter((v) => v.status === 'low_stock').length;
  const overallStatus: ProductStockSummary['overallStatus'] =
    vIn > 0 && (vOut > 0 || totals.totalCurrentStock === 0)
      ? 'incoming'
      : vOut === variants.length
        ? 'out_of_stock'
        : vCrit > 0 || vOut > 0
          ? 'critical'
          : vLow > 0
            ? 'low_stock'
            : 'in_stock';
  return {
    productId: `p${i}`,
    productName: `Produto ${i}`,
    productSku: `P${i}`,
    overallStatus,
    // 'in_stock'|'incoming'|'overstocked' → variantsInStock (mirrors BUG-A fix)
    variantsInStock: variants.filter(
      (v) => v.status === 'in_stock' || v.status === 'incoming' || v.status === 'overstocked',
    ).length,
    variantsLowStock: vLow,
    variantsCritical: vCrit,
    variantsOutOfStock: vOut,
    availableColors: [],
    ...totals,
    variants,
  };
}

function makeFilters(rnd: () => number): StockFilters {
  const pickColor = rnd() < 0.6;
  const pickGroup = !pickColor && rnd() < 0.3;
  const pickMin = rnd() < 0.5;
  const pickStatus = rnd() < 0.4;
  return {
    ...defaultStockFilters,
    sortBy: 'name',
    sortDirection: 'asc',
    colorName: pickColor ? COLORS[Math.floor(rnd() * COLORS.length)] : undefined,
    colorGroup: pickGroup ? COLORS[Math.floor(rnd() * COLORS.length)] : undefined,
    minQuantityNeeded: pickMin ? Math.floor(rnd() * 800) : undefined,
    status: pickStatus ? STATUSES[Math.floor(rnd() * STATUSES.length)] : 'all',
    search: rnd() < 0.15 ? COLORS[Math.floor(rnd() * COLORS.length)].slice(0, 3) : '',
  };
}

interface SimReport {
  total: number;
  nonEmpty: number;
  withColorFilter: number;
  withMinQty: number;
  maxResult: number;
}

describe('stock-filter — fuzz (500 simulações)', () => {
  it('mantém invariantes em todas as combinações aleatórias', () => {
    const rnd = mulberry32(20260616);
    const universe = Array.from({ length: 60 }, (_, i) => makeProduct(rnd, i));
    const universeIds = new Set(universe.map((p) => p.productId));
    const indexes = buildStockIndexes(universe);

    const report: SimReport = {
      total: 0,
      nonEmpty: 0,
      withColorFilter: 0,
      withMinQty: 0,
      maxResult: 0,
    };

    const SIMS = 500;
    for (let i = 0; i < SIMS; i++) {
      const filters = makeFilters(rnd);
      const hasColor = Boolean(filters.colorName) || Boolean(filters.colorGroup);
      const minQty = filters.minQuantityNeeded ?? 0;

      const a = applyStockFilters(universe, filters, [], indexes);
      const b = applyStockFilters(universe, filters, [], indexes);

      report.total += 1;
      if (a.length > 0) report.nonEmpty += 1;
      if (hasColor) report.withColorFilter += 1;
      if (minQty > 0) report.withMinQty += 1;
      if (a.length > report.maxResult) report.maxResult = a.length;

      // (7) Idempotência
      expect(a).toEqual(b);

      // (8) Subset do universo, sem duplicatas
      const seen = new Set<string>();
      for (const prod of a) {
        expect(universeIds.has(prod.productId)).toBe(true);
        expect(seen.has(prod.productId)).toBe(false);
        seen.add(prod.productId);

        // (4) totalVariants consistente
        expect(prod.totalVariants).toBe(prod.variants.length);

        // (2) Totais batem com soma real das variações projetadas
        const agg = aggregateVariantTotals(prod.variants);
        expect(prod.totalCurrentStock).toBe(agg.totalCurrentStock);
        expect(prod.totalAvailableStock).toBe(agg.totalAvailableStock);
        expect(prod.totalReservedStock).toBe(agg.totalReservedStock);
        expect(prod.totalInTransitStock).toBe(agg.totalInTransitStock);
        expect(prod.totalMinStock).toBe(agg.totalMinStock);

        // (1) Toda variação casa com o filtro de cor
        if (filters.colorName) {
          for (const v of prod.variants) {
            expect(normalize(v.colorName)).toBe(normalize(filters.colorName));
          }
          for (const c of prod.availableColors) {
            expect(normalize(c.colorName)).toBe(normalize(filters.colorName));
          }
        }
        if (filters.colorGroup) {
          const g = normalize(filters.colorGroup);
          for (const v of prod.variants) {
            expect(normalize(v.colorName).includes(g)).toBe(true);
          }
          for (const c of prod.availableColors) {
            expect(normalize(c.colorName).includes(g)).toBe(true);
          }
        }

        // (3) minQty respeitado contra pool filtrado
        if (minQty > 0) {
          const pool = hasColor
            ? prod.variants.reduce((s, v) => s + v.availableStock, 0)
            : prod.totalAvailableStock;
          expect(pool).toBeGreaterThanOrEqual(minQty);
        }

        // (5) Sem filtro de cor → identidade da array de variantes preservada
        if (!hasColor) {
          const original = universe.find((u) => u.productId === prod.productId)!;
          expect(prod.variants).toBe(original.variants);
        }
      }
    }

    // (6) Reuso de índice entre filtros distintos: roda 3 filtros e reseta — saída final estável
    const filtersA: StockFilters = { ...defaultStockFilters, sortBy: 'name', colorName: 'Azul' };
    const filtersB: StockFilters = {
      ...defaultStockFilters,
      sortBy: 'name',
      colorName: 'Verde',
      minQuantityNeeded: 200,
    };
    const r1 = applyStockFilters(universe, filtersA, [], indexes);
    applyStockFilters(universe, filtersB, [], indexes);
    const r2 = applyStockFilters(universe, filtersA, [], indexes);
    expect(r1).toEqual(r2);

    // log mínimo p/ inspeção
    // eslint-disable-next-line no-console
    console.log('[stock-filter fuzz]', report);
    expect(report.total).toBe(SIMS);
  });

  it('cor inexistente sempre retorna lista vazia (fast-path via índice)', () => {
    const rnd = mulberry32(1);
    const universe = Array.from({ length: 30 }, (_, i) => makeProduct(rnd, i));
    const indexes = buildStockIndexes(universe);
    for (let i = 0; i < 50; i++) {
      const out = applyStockFilters(
        universe,
        { ...defaultStockFilters, colorName: `Inexistente-${i}` },
        [],
        indexes,
      );
      expect(out).toEqual([]);
    }
  });
});
