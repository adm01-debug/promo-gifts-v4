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
      const pool = hasVar ? vs.reduce((s, v) => s + v.availableStock, 0) : p.totalAvailableStock;
      return pool >= minQ;
    })
    .map(({ p, vs }) => ({
      productId: p.productId,
      totalVariants: hasVar ? vs.length : p.variants.length,
      totalCurrentStock: hasVar ? vs.reduce((s, v) => s + v.currentStock, 0) : p.totalCurrentStock,
    }));
}

// Seeds reproduzíveis: cada iteração deriva sua própria seed a partir da
// MASTER_SEED, permitindo replay exato via STRESS_REPLAY_SEED=<n>.
// Variáveis suportadas:
//   STRESS_MASTER_SEED   (default 0xbeef)  — semente do RNG mestre
//   STRESS_SIMS          (default 5000)    — nº de simulações
//   STRESS_UNIVERSE_SEED (default 0xa5ee5) — semente do universo
//   STRESS_REPLAY_SEED   (opcional)        — reexecuta SÓ a iteração com essa seed
const ENV = (typeof process !== 'undefined' ? process.env : {}) as Record<
  string,
  string | undefined
>;
const MASTER_SEED = Number(ENV.STRESS_MASTER_SEED ?? 0xbeef);
const UNIVERSE_SEED = Number(ENV.STRESS_UNIVERSE_SEED ?? 0xa5ee5);
const SIMS = Number(ENV.STRESS_SIMS ?? 5000);
const REPLAY_SEED = ENV.STRESS_REPLAY_SEED ? Number(ENV.STRESS_REPLAY_SEED) : undefined;

function deriveSeed(master: number, i: number): number {
  let x = (master ^ (i * 0x9e3779b1)) >>> 0;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return x >>> 0;
}

describe('stock-filter.stress — simulações reproduzíveis vs oráculo', () => {
  it(`fast-path === naïve [master=0x${MASTER_SEED.toString(16)} sims=${SIMS}]`, () => {
    const universe = makeUniverse(UNIVERSE_SEED, 200);
    const indexes = buildStockIndexes(universe);
    const iterations =
      REPLAY_SEED !== undefined
        ? [REPLAY_SEED]
        : Array.from({ length: SIMS }, (_, i) => deriveSeed(MASTER_SEED, i));

    const failures: Array<{ seed: number; filters: StockFilters }> = [];
    let nonEmpty = 0;
    let maxResult = 0;

    for (const seed of iterations) {
      const rnd = mulberry32(seed);
      const f = makeFilters(rnd);
      const actual = applyStockFilters(universe, f, [], indexes);
      const oracle = naiveFilter(universe, f).sort((a, b) =>
        a.productId.localeCompare(b.productId),
      );
      const actualSorted = actual
        .map((p) => ({
          productId: p.productId,
          totalVariants: p.totalVariants,
          totalCurrentStock: p.totalCurrentStock,
        }))
        .sort((a, b) => a.productId.localeCompare(b.productId));

      if (JSON.stringify(actualSorted) !== JSON.stringify(oracle)) {
        failures.push({ seed, filters: f });
        if (failures.length <= 5) {
          // eslint-disable-next-line no-console
          console.error(
            `[stress mismatch] replay exato: STRESS_REPLAY_SEED=${seed} STRESS_MASTER_SEED=${MASTER_SEED} STRESS_UNIVERSE_SEED=${UNIVERSE_SEED}`,
            { filters: f, actual: actualSorted, oracle },
          );
        }
      }
      if (actual.length > 0) nonEmpty++;
      if (actual.length > maxResult) maxResult = actual.length;
    }

    // eslint-disable-next-line no-console
    console.log('[stock-filter stress]', {
      master_seed: `0x${MASTER_SEED.toString(16)}`,
      universe_seed: `0x${UNIVERSE_SEED.toString(16)}`,
      sims: iterations.length,
      mismatches: failures.length,
      nonEmpty,
      maxResult,
      replay: REPLAY_SEED !== undefined ? `0x${REPLAY_SEED.toString(16)}` : null,
    });
    expect(
      failures,
      failures.length
        ? `Reexecute: STRESS_REPLAY_SEED=${failures[0].seed} STRESS_MASTER_SEED=${MASTER_SEED}`
        : '',
    ).toEqual([]);
  });

  it('invariantes globais sob 1000 simulações extras com seeds derivadas', () => {
    const universe = makeUniverse(0x1234, 100);
    const indexes = buildStockIndexes(universe);
    const INV_MASTER = Number(ENV.STRESS_INVARIANT_SEED ?? 0x9999);

    for (let i = 0; i < 1000; i++) {
      const seed = deriveSeed(INV_MASTER, i);
      const rnd = mulberry32(seed);
      const f = makeFilters(rnd);
      const out = applyStockFilters(universe, f, [], indexes);
      const seen = new Set<string>();
      for (const p of out) {
        if (seen.has(p.productId)) {
          // eslint-disable-next-line no-console
          console.error(
            `[invariant fail] duplicado em STRESS_REPLAY_SEED=${seed} STRESS_INVARIANT_SEED=${INV_MASTER}`,
          );
        }
        expect(seen.has(p.productId)).toBe(false);
        seen.add(p.productId);
        expect(p.totalVariants).toBe(p.variants.length);
        const sum = p.variants.reduce((s, v) => s + v.currentStock, 0);
        expect(p.totalCurrentStock).toBe(sum);
      }
    }
  });
});
