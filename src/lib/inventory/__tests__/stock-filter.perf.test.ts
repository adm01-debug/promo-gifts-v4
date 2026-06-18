/**
 * stock-filter — fuzz determinístico 1000x + benchmark de alternância de filtros.
 *
 * Objetivos:
 *  • Reproduzir 1000 simulações com semente fixa, garantindo idempotência
 *    (mesma entrada → mesma saída) e ausência de duplicatas em todas as rodadas.
 *  • Medir o tempo de alternância de filtros sobre um universo grande (1500
 *    produtos × ~3 variações) e falhar se ultrapassar o alvo de performance.
 *
 * Alvo: < 50ms em média por alternância de filtro (CI relaxa p/ 150ms via env).
 */
import { describe, expect, it } from 'vitest';
import { applyStockFilters, buildStockIndexes } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type StockStatus,
  type VariantStock,
} from '@/types/stock';

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
const STATUSES: StockStatus[] = ['in_stock', 'low_stock', 'critical', 'out_of_stock', 'incoming'];

function makeVariant(rnd: () => number, pid: string, idx: number): VariantStock {
  const color = COLORS[Math.floor(rnd() * COLORS.length)];
  const status = STATUSES[Math.floor(rnd() * STATUSES.length)];
  const currentStock = status === 'out_of_stock' ? 0 : Math.floor(rnd() * 1500);
  const reserved = Math.min(currentStock, Math.floor(rnd() * 50));
  return {
    id: `${pid}-v${idx}`,
    productId: pid,
    variantId: `${pid}-v${idx}`,
    variantSku: `${pid.toUpperCase()}-${color.slice(0, 3).toUpperCase()}${idx}`,
    colorName: color,
    currentStock,
    minStock: Math.floor(rnd() * 30),
    reservedStock: reserved,
    inTransitStock: status === 'incoming' ? Math.floor(rnd() * 100) + 1 : 0,
    availableStock: Math.max(0, currentStock - reserved),
    status,
    updatedAt: '2026-01-01',
  };
}

function makeProduct(rnd: () => number, i: number): ProductStockSummary {
  const variants = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, k) =>
    makeVariant(rnd, `p${i}`, k),
  );
  const totalCurrentStock = variants.reduce((s, v) => s + v.currentStock, 0);
  const totalAvailableStock = variants.reduce((s, v) => s + v.availableStock, 0);
  const totalReservedStock = variants.reduce((s, v) => s + v.reservedStock, 0);
  const totalInTransitStock = variants.reduce((s, v) => s + v.inTransitStock, 0);
  const totalMinStock = variants.reduce((s, v) => s + v.minStock, 0);
  return {
    productId: `p${i}`,
    productName: `Produto ${i}`,
    productSku: `P${i}`,
    overallStatus: 'in_stock',
    variantsInStock: variants.filter((v) => v.status === 'in_stock').length,
    variantsLowStock: variants.filter((v) => v.status === 'low_stock').length,
    variantsCritical: variants.filter((v) => v.status === 'critical').length,
    variantsOutOfStock: variants.filter((v) => v.status === 'out_of_stock').length,
    availableColors: [],
    totalVariants: variants.length,
    totalCurrentStock,
    totalAvailableStock,
    totalReservedStock,
    totalInTransitStock,
    totalMinStock,
    variants,
  };
}

function makeFilters(rnd: () => number): StockFilters {
  const pickColor = rnd() < 0.6;
  const pickGroup = !pickColor && rnd() < 0.3;
  return {
    ...defaultStockFilters,
    sortBy: 'name',
    sortDirection: 'asc',
    colorName: pickColor ? COLORS[Math.floor(rnd() * COLORS.length)] : undefined,
    colorGroup: pickGroup ? COLORS[Math.floor(rnd() * COLORS.length)] : undefined,
    minQuantityNeeded: rnd() < 0.5 ? Math.floor(rnd() * 800) : undefined,
    status: rnd() < 0.4 ? STATUSES[Math.floor(rnd() * STATUSES.length)] : 'all',
    search: rnd() < 0.15 ? COLORS[Math.floor(rnd() * COLORS.length)].slice(0, 3) : '',
  };
}

describe('stock-filter — fuzz determinístico 1000x', () => {
  it('idempotência + ausência de duplicatas em 1000 simulações (seed fixa)', () => {
    const rnd = mulberry32(0xc0ffee16);
    const universe = Array.from({ length: 80 }, (_, i) => makeProduct(rnd, i));
    const ids = new Set(universe.map((p) => p.productId));
    const indexes = buildStockIndexes(universe, []);

    let dup = 0;
    let mismatch = 0;
    for (let i = 0; i < 1000; i++) {
      const f = makeFilters(rnd);
      const a = applyStockFilters(universe, f, [], indexes);
      const b = applyStockFilters(universe, f, [], indexes);
      if (JSON.stringify(a) !== JSON.stringify(b)) mismatch++;
      const seen = new Set<string>();
      for (const p of a) {
        if (!ids.has(p.productId)) mismatch++;
        if (seen.has(p.productId)) dup++;
        seen.add(p.productId);
      }
    }
    expect(mismatch).toBe(0);
    expect(dup).toBe(0);
  });
});

describe('stock-filter — performance ao alternar filtros', () => {
  it('média < alvo (50ms local / 150ms CI) ao alternar 6 filtros sobre 1500 produtos', () => {
    const rnd = mulberry32(0xdeadbeef);
    const universe = Array.from({ length: 1500 }, (_, i) => makeProduct(rnd, i));
    const indexes = buildStockIndexes(universe, []);

    const filterCycle: StockFilters[] = [
      { ...defaultStockFilters, sortBy: 'name', colorName: 'Azul' },
      { ...defaultStockFilters, sortBy: 'name', colorName: 'Vermelho', minQuantityNeeded: 300 },
      { ...defaultStockFilters, sortBy: 'name', colorGroup: 'Verde' },
      { ...defaultStockFilters, sortBy: 'name', status: 'critical' },
      { ...defaultStockFilters, sortBy: 'name', search: 'azu', minQuantityNeeded: 100 },
      { ...defaultStockFilters, sortBy: 'name' }, // reset
    ];

    // warmup p/ amortizar JIT
    for (const f of filterCycle) applyStockFilters(universe, f, [], indexes);

    const RUNS = 60;
    const samples: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const f = filterCycle[r % filterCycle.length];
      const t0 = performance.now();
      applyStockFilters(universe, f, [], indexes);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    const p95 = samples[Math.floor(samples.length * 0.95)];

    const target = process.env.CI ? 150 : 50;
    console.log(
      `[stock-filter perf] avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms target=${target}ms n=${RUNS}`,
    );
    expect(avg).toBeLessThan(target);
    expect(p95).toBeLessThan(target * 2);
  });
});
