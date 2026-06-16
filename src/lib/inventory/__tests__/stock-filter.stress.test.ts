/**
 * stock-filter.stress — Bateria exaustiva (5000 simulações) cobrindo TODOS
 * os caminhos da arquitetura SSOT: normalização + interseção de índices +
 * projeção. Compara o resultado contra uma implementação naïve de referência
 * (oráculo) para detectar discrepâncias.
 *
 * Estratégia:
 *   1. Universo de 200 produtos com 1–8 variações cada, com:
 *      - 30% de categorias/fornecedores com acento/maiúscula
 *      - 10% de produtos sem categoria
 *      - 5% de variantes sem cor (testa NPE)
 *   2. Filtros aleatórios cobrindo TODOS os campos.
 *   3. Oráculo aplica os mesmos critérios via filter/normalize "à mão".
 *   4. Assert: ids retornados, totalVariants e totalCurrentStock IDÊNTICOS
 *      entre fast-path (índices) e naïve.
 *   5. Verifica invariantes adicionais.
 */
import { describe, expect, it } from 'vitest';
import { applyStockFilters, buildStockIndexes, normalize } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
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

const CATS = ['Canetas', 'CANETAS', 'Cadernos', 'Agêndas', 'agendas', 'Mochilas', 'Açaí'];
const SUPS = ['Fornecedor A', 'fornecedor a', 'Fornecedor B', 'Fornecedor Açaí', 'OUTRO'];
const COLORS = ['Azul', 'Azul Marinho', 'Verde', 'Vermelho', 'Preto', 'Branco', 'Rosa'];

function makeUniverse(seed: number, n: number): ProductStockSummary[] {
  const rnd = mulberry32(seed);
  const out: ProductStockSummary[] = [];
  for (let i = 0; i < n; i++) {
    const nVar = 1 + Math.floor(rnd() * 8);
    const variants: VariantStock[] = [];
    for (let k = 0; k < nVar; k++) {
      const noColor = rnd() < 0.05;
      const stock = Math.floor(rnd() * 2000);
      const reserved = Math.min(stock, Math.floor(rnd() * 30));
      variants.push({
        id: `p${i}-v${k}`,
        productId: `p${i}`,
        variantId: `p${i}-v${k}`,
        variantSku: `P${i}V${k}`,
        colorName: noColor ? undefined : COLORS[Math.floor(rnd() * COLORS.length)],
        currentStock: stock,
        minStock: Math.floor(rnd() * 50),
        reservedStock: reserved,
        inTransitStock: rnd() < 0.2 ? Math.floor(rnd() * 100) : 0,
        availableStock: Math.max(0, stock - reserved),
        status: stock === 0 ? 'out_of_stock' : 'in_stock',
        updatedAt: '2026-01-01',
      });
    }
    out.push({
      productId: `p${i}`,
      productName: `Produto ${i}`,
      productSku: `SKU${i}`,
      categoryName: rnd() < 0.1 ? undefined : CATS[Math.floor(rnd() * CATS.length)],
      supplierName: SUPS[Math.floor(rnd() * SUPS.length)],
      overallStatus: 'in_stock',
      variantsInStock: variants.filter((v) => v.status === 'in_stock').length,
      variantsLowStock: 0,
      variantsCritical: 0,
      variantsOutOfStock: variants.filter((v) => v.status === 'out_of_stock').length,
      availableColors: [],
      totalVariants: variants.length,
      totalCurrentStock: variants.reduce((s, v) => s + v.currentStock, 0),
      totalMinStock: variants.reduce((s, v) => s + v.minStock, 0),
      totalReservedStock: variants.reduce((s, v) => s + v.reservedStock, 0),
      totalInTransitStock: variants.reduce((s, v) => s + v.inTransitStock, 0),
      totalAvailableStock: variants.reduce((s, v) => s + v.availableStock, 0),
      variants,
    });
  }
  return out;
}

function makeFilters(rnd: () => number): StockFilters {
  return {
    ...defaultStockFilters,
    sortBy: 'name',
    sortDirection: 'asc',
    categoryId: rnd() < 0.4 ? CATS[Math.floor(rnd() * CATS.length)] : undefined,
    supplierId: rnd() < 0.4 ? SUPS[Math.floor(rnd() * SUPS.length)] : undefined,
    colorName: rnd() < 0.3 ? COLORS[Math.floor(rnd() * COLORS.length)] : undefined,
    colorGroup: rnd() < 0.15 ? COLORS[Math.floor(rnd() * COLORS.length)].split(' ')[0] : undefined,
    minQuantityNeeded: rnd() < 0.3 ? Math.floor(rnd() * 1000) : undefined,
  };
}

// ---- Oráculo (implementação naïve de referência, sem índices) ----
function naiveFilter(
  products: ProductStockSummary[],
  f: StockFilters,
): { productId: string; totalVariants: number; totalCurrentStock: number }[] {
  const catN = normalize(f.categoryId);
  const supN = normalize(f.supplierId);
  const colN = normalize(f.colorName);
  const grpN = normalize(f.colorGroup);
  const minQ = f.minQuantityNeeded ?? 0;
  const hasVar = Boolean(f.colorName) || Boolean(f.colorGroup);

  return products
    .filter((p) => !catN || normalize(p.categoryName) === catN)
    .filter((p) => !supN || normalize(p.supplierName) === supN)
    .map((p) => {
      const vs = !hasVar
        ? p.variants
        : p.variants.filter((v) => {
            const cn = normalize(v.colorName);
            const cg = normalize(v.colorGroup);
            if (colN && cn !== colN) return false;
            if (grpN && !cn.includes(grpN) && !cg.includes(grpN)) return false;
            return true;
          });
      return { p, vs };
    })
    .filter(({ vs }) => !hasVar || vs.length > 0)
    .filter(({ vs, p }) => {
      if (minQ <= 0) return true;
      const pool = hasVar
        ? vs.reduce((s, v) => s + v.availableStock, 0)
        : p.totalAvailableStock;
      return pool >= minQ;
    })
    .map(({ p, vs }) => ({
      productId: p.productId,
      totalVariants: hasVar ? vs.length : p.variants.length,
      totalCurrentStock: hasVar
        ? vs.reduce((s, v) => s + v.currentStock, 0)
        : p.totalCurrentStock,
    }));
}

describe('stock-filter.stress — 5000 simulações vs oráculo', () => {
  it('fast-path com índices === implementação naïve', () => {
    const universe = makeUniverse(0xa5ee5, 200);
    const indexes = buildStockIndexes(universe, []);
    const rnd = mulberry32(0xbeef);

    let mismatches = 0;
    let nonEmpty = 0;
    let maxResult = 0;
    const SIMS = 5000;

    for (let i = 0; i < SIMS; i++) {
      const f = makeFilters(rnd);
      const actual = applyStockFilters(universe, f, [], indexes);
      const oracle = naiveFilter(universe, f).sort((a, b) => a.productId.localeCompare(b.productId));
      const actualSorted = actual
        .map((p) => ({
          productId: p.productId,
          totalVariants: p.totalVariants,
          totalCurrentStock: p.totalCurrentStock,
        }))
        .sort((a, b) => a.productId.localeCompare(b.productId));

      if (JSON.stringify(actualSorted) !== JSON.stringify(oracle)) {
        mismatches++;
        if (mismatches <= 3) {
          // eslint-disable-next-line no-console
          console.error('[mismatch]', { filters: f, actual: actualSorted, oracle });
        }
      }
      if (actual.length > 0) nonEmpty++;
      if (actual.length > maxResult) maxResult = actual.length;
    }

    // eslint-disable-next-line no-console
    console.log('[stock-filter stress]', { SIMS, mismatches, nonEmpty, maxResult });
    expect(mismatches).toBe(0);
  });

  it('invariantes globais sob 1000 simulações extras', () => {
    const universe = makeUniverse(0x1234, 100);
    const indexes = buildStockIndexes(universe, []);
    const rnd = mulberry32(0x9999);

    for (let i = 0; i < 1000; i++) {
      const f = makeFilters(rnd);
      const out = applyStockFilters(universe, f, [], indexes);
      const seen = new Set<string>();
      for (const p of out) {
        // sem duplicatas
        expect(seen.has(p.productId)).toBe(false);
        seen.add(p.productId);
        // totalVariants === variants.length
        expect(p.totalVariants).toBe(p.variants.length);
        // soma de currentStock bate
        const sum = p.variants.reduce((s, v) => s + v.currentStock, 0);
        expect(p.totalCurrentStock).toBe(sum);
      }
    }
  });
});
