/**
 * stock-filter.future-minqty.fuzz — simulações reproduzíveis (PRNG seeded)
 * focadas no flag `minQtyIncludesFutureStock` adicionado para corrigir o bug
 * "≥ 500 un retornando produtos com 0 un / Esgotado".
 *
 * Invariantes garantidas em CADA simulação:
 *  (I1) Modo estrito (sub-toggle OFF) NUNCA admite produto cujo
 *       availableStock < minQty, independentemente de Estoque Futuro.
 *  (I2) Resultado(estrito) ⊆ Resultado(com futuro) — ligar o sub-toggle só
 *       pode manter ou aumentar o conjunto.
 *  (I3) Quando `includeFutureStock=false`, o sub-toggle é inerte
 *       (mesmo conjunto que estrito).
 *  (I4) Reposições fora da janela (`expectedReplenishDate > now+window`)
 *       NUNCA contribuem ao pool, mesmo com sub-toggle ON.
 */
import { describe, it, expect } from 'vitest';
import { applyStockFilters, aggregateVariantTotals } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type VariantStock,
} from '@/types/stock';

// ---------- PRNG mulberry32 (determinístico) ----------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ['Azul', 'Verde', 'Vermelho', 'Preto', 'Amarelo', 'Rosa', 'Branco'];

function makeVariant(rng: () => number, productId: string, idx: number): VariantStock {
  const color = COLORS[Math.floor(rng() * COLORS.length)];
  const current = Math.floor(rng() * 800); // 0..799
  const reserved = Math.floor(rng() * Math.min(current, 50));
  const inTransit = Math.floor(rng() * 200);
  const available = Math.max(0, current - reserved);
  const hasFuture = rng() < 0.5;
  const future = hasFuture ? Math.floor(rng() * 1000) : 0;
  // Janela: metade das reposições dentro de 30d, metade fora (60..120d).
  const withinWindow = rng() < 0.5;
  const daysAhead = withinWindow ? Math.floor(rng() * 28) + 1 : Math.floor(rng() * 60) + 60;
  const expectedReplenishDate = hasFuture
    ? new Date(Date.now() + daysAhead * 86_400_000).toISOString()
    : undefined;
  return {
    id: `${productId}-v${idx}`,
    productId,
    variantId: `${productId}-v${idx}`,
    variantSku: `${productId}-${color.slice(0, 2).toUpperCase()}${idx}`,
    colorName: color,
    currentStock: current,
    minStock: 10,
    reservedStock: reserved,
    inTransitStock: inTransit,
    availableStock: available,
    status: available === 0 ? 'out_of_stock' : 'in_stock',
    updatedAt: '2026-01-01',
    futureStock: future,
    expectedReplenishDate,
  } as VariantStock;
}

function makeProduct(rng: () => number, idx: number): ProductStockSummary {
  const id = `p${idx}`;
  const variants = Array.from({ length: 1 + Math.floor(rng() * 5) }, (_, i) =>
    makeVariant(rng, id, i),
  );
  const totals = aggregateVariantTotals(variants);
  return {
    productId: id,
    productName: `Produto ${idx}`,
    productSku: id.toUpperCase(),
    overallStatus: totals.totalAvailableStock > 0 ? 'in_stock' : 'out_of_stock',
    variantsInStock: variants.filter((x) => x.status === 'in_stock').length,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: variants.filter((x) => x.status === 'out_of_stock').length,
    availableColors: [],
    ...totals,
    variants,
  };
}

const baseFilters = (over: Partial<StockFilters>): StockFilters => ({
  ...defaultStockFilters,
  sortBy: 'name',
  sortDirection: 'asc',
  ...over,
});

describe('stock-filter.future-minqty.fuzz — invariantes do sub-toggle', () => {
  it('500 simulações respeitam I1, I2, I3 e I4', () => {
    const rng = mulberry32(0xc0ffee);
    let totalSims = 0;
    let strictNonEmpty = 0;
    let withFutureGrew = 0;
    let inertCases = 0;
    let outOfWindowCases = 0;
    const violations: string[] = [];

    for (let s = 0; s < 500; s++) {
      const universe = Array.from({ length: 50 }, (_, i) => makeProduct(rng, i + s * 50));
      const minQty = 100 + Math.floor(rng() * 700);
      const useColor = rng() < 0.6;
      const color = useColor ? COLORS[Math.floor(rng() * COLORS.length)] : undefined;
      const includeFutureStock = rng() < 0.5;
      const windowDays = ([7, 15, 30] as const)[Math.floor(rng() * 3)];

      const strict = applyStockFilters(
        universe,
        baseFilters({
          colorName: color,
          minQuantityNeeded: minQty,
          includeFutureStock,
          futureStockWindowDays: windowDays,
          minQtyIncludesFutureStock: false,
        }),
        [],
      );
      const withFuture = applyStockFilters(
        universe,
        baseFilters({
          colorName: color,
          minQuantityNeeded: minQty,
          includeFutureStock,
          futureStockWindowDays: windowDays,
          minQtyIncludesFutureStock: true,
        }),
        [],
      );

      // (I1) Modo estrito: cada produto deve ter pool atual >= minQty
      for (const p of strict) {
        const pool = useColor
          ? p.variants
              .filter((v) => v.colorName === color)
              .reduce((sum, v) => sum + Math.max(0, v.availableStock), 0)
          : Math.max(0, p.totalAvailableStock);
        if (pool < minQty) {
          violations.push(`I1: sim=${s} ${p.productId} pool=${pool} < minQty=${minQty}`);
        }
      }

      // (I2) Resultado(estrito) ⊆ Resultado(com futuro)
      const strictIds = new Set(strict.map((p) => p.productId));
      const withFutureIds = new Set(withFuture.map((p) => p.productId));
      for (const id of strictIds) {
        if (!withFutureIds.has(id)) {
          violations.push(`I2: sim=${s} ${id} no estrito mas FORA do com-futuro`);
        }
      }

      // (I3) includeFutureStock=false → sub-toggle inerte
      if (!includeFutureStock) {
        if (strict.length !== withFuture.length) {
          violations.push(
            `I3: sim=${s} sub-toggle NÃO inerte quando Futuro OFF (${strict.length} vs ${withFuture.length})`,
          );
        } else {
          inertCases++;
        }
      }

      // (I4) Reposição fora da janela não contribui — verificado indiretamente:
      // se um produto SÓ tem futuro fora da janela, withFuture não pode incluí-lo
      // a mais do que o estrito o incluiria.
      const cutoff = Date.now() + windowDays * 86_400_000;
      for (const p of withFuture) {
        if (strictIds.has(p.productId)) continue; // já no estrito → ok
        // entrou no withFuture mas não no strict → tem que existir ao menos UMA
        // variação com reposição DENTRO da janela
        const hasInWindow = p.variants.some((v) => {
          if (!v.futureStock || v.futureStock <= 0) return false;
          if (!v.expectedReplenishDate) return false;
          const t = Date.parse(v.expectedReplenishDate);
          return !Number.isNaN(t) && t <= cutoff;
        });
        if (includeFutureStock && !hasInWindow) {
          violations.push(`I4: sim=${s} ${p.productId} entrou via futuro SEM reposição na janela`);
        }
        if (!includeFutureStock) outOfWindowCases++; // não deveria estar aqui (cobre I3)
      }

      if (strict.length > 0) strictNonEmpty++;
      if (withFuture.length > strict.length) withFutureGrew++;
      totalSims++;
    }

    // Diagnóstico — útil ao depurar regressão futura.
    // eslint-disable-next-line no-console
    console.log('[future-minqty fuzz]', {
      totalSims,
      strictNonEmpty,
      withFutureGrew,
      inertCases,
      outOfWindowCases,
      violations: violations.length,
      firstViolation: violations[0] ?? null,
    });

    expect(violations).toEqual([]);
    expect(totalSims).toBe(500);
    // Sanidade: pelo menos UMA simulação deve mostrar o sub-toggle expandindo o resultado.
    expect(withFutureGrew).toBeGreaterThan(0);
  });

  it('reprodução do bug original (verde + ≥500 + futuro 30d ON, sub-toggle OFF): produto com 0 atual fica FORA', () => {
    const inTen = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const data: ProductStockSummary[] = [
      {
        productId: 'chaveiro',
        productName: 'Chaveiro capacete epi',
        productSku: 'CHAV-VD',
        overallStatus: 'out_of_stock',
        variantsInStock: 0,
        variantsLowStock: 0,
        variantsCritical: 0,
        variantsOutOfStock: 1,
        availableColors: [
          {
            colorName: 'Verde',
            totalStock: 0,
            availableStock: 0,
            status: 'out_of_stock' as const,
            variants: [],
          },
        ],
        ...aggregateVariantTotals([
          {
            id: 'c-vd',
            productId: 'chaveiro',
            variantId: 'c-vd',
            variantSku: 'C-VD',
            colorName: 'Verde',
            currentStock: 0,
            minStock: 0,
            reservedStock: 0,
            inTransitStock: 0,
            availableStock: 0,
            status: 'out_of_stock',
            updatedAt: '2026-01-01',
            futureStock: 800,
            expectedReplenishDate: inTen,
          } as VariantStock,
        ]),
        variants: [
          {
            id: 'c-vd',
            productId: 'chaveiro',
            variantId: 'c-vd',
            variantSku: 'C-VD',
            colorName: 'Verde',
            currentStock: 0,
            minStock: 0,
            reservedStock: 0,
            inTransitStock: 0,
            availableStock: 0,
            status: 'out_of_stock',
            updatedAt: '2026-01-01',
            futureStock: 800,
            expectedReplenishDate: inTen,
          } as VariantStock,
        ],
      },
    ];

    const strict = applyStockFilters(
      data,
      baseFilters({
        colorName: 'Verde',
        minQuantityNeeded: 500,
        includeFutureStock: true,
        futureStockWindowDays: 30,
        minQtyIncludesFutureStock: false,
      }),
      [],
    );
    expect(strict).toHaveLength(0);

    const withFuture = applyStockFilters(
      data,
      baseFilters({
        colorName: 'Verde',
        minQuantityNeeded: 500,
        includeFutureStock: true,
        futureStockWindowDays: 30,
        minQtyIncludesFutureStock: true,
      }),
      [],
    );
    expect(withFuture).toHaveLength(1);
  });
});
