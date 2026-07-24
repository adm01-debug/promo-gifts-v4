/**
 * stock-filter.future-segments — cobertura do caminho granular de Estoque Futuro.
 *
 * Contexto do bug corrigido:
 *   No pipeline real (`stockFetcher`), uma variação podia ter 3 chegadas
 *   (`next_quantity_1..3` / `next_date_1..3`) com datas distintas, mas eram
 *   colapsadas num único `futureStock` (soma) atrelado a `futureStockDate`
 *   (= apenas a 1ª data). Isso fazia a janela de Estoque Futuro:
 *     - SUPERESTIMAR: contar chegadas distantes (2ª/3ª) quando só a 1ª estava
 *       na janela curta;
 *     - SUBESTIMAR: ignorar uma chegada cuja 2ª/3ª data estava na janela mas a
 *       1ª não.
 *
 * Correção: `VariantStock.futureSegments` (qtd × data). A janela soma APENAS
 * segmentos com `date ≤ cutoff`. Quando ausente, mantém o contrato de data
 * única (testado nas demais suítes).
 */
import { describe, it, expect } from 'vitest';
import { applyStockFilters } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type VariantStock,
} from '@/types/stock';

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

function makeProduct(variant: Partial<VariantStock>): ProductStockSummary {
  const v: VariantStock = {
    id: 'v1',
    productId: 'p1',
    variantId: 'v1',
    variantSku: 'V1',
    colorName: 'Azul',
    currentStock: 0,
    minStock: 10,
    reservedStock: 0,
    inTransitStock: 0,
    availableStock: 0,
    status: 'out_of_stock',
    updatedAt: '2026-01-01',
    ...variant,
  };
  return {
    productId: 'p1',
    productName: 'Produto 1',
    productSku: 'P1',
    totalCurrentStock: v.currentStock,
    totalMinStock: v.minStock,
    totalReservedStock: v.reservedStock,
    totalInTransitStock: v.inTransitStock,
    totalAvailableStock: v.availableStock,
    overallStatus: v.status,
    variantsInStock: v.availableStock > 0 ? 1 : 0,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: v.availableStock > 0 ? 0 : 1,
    totalVariants: 1,
    variants: [v],
    availableColors: [],
  };
}

const filters = (over: Partial<StockFilters>): StockFilters => ({
  ...defaultStockFilters,
  sortBy: 'name',
  sortDirection: 'asc',
  ...over,
});

describe('stock-filter — Estoque Futuro granular (futureSegments)', () => {
  it('janela curta soma SÓ o segmento dentro dela (não superestima)', () => {
    // Chegada perto (5d): 100 un. Chegada longe (60d): 900 un.
    const product = makeProduct({
      futureSegments: [
        { quantity: 100, date: daysFromNow(5) },
        { quantity: 900, date: daysFromNow(60) },
      ],
    });
    // Preciso de 500 un, janela 7d: só os 100 contam → produto NÃO entra.
    const win7 = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(win7).toHaveLength(0);

    // Janela 30d ainda só pega os 100 (a 2ª chegada é em 60d).
    const win30 = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 30,
      }),
      [],
    );
    expect(win30).toHaveLength(0);
  });

  it('janela longa soma todos os segmentos cobertos', () => {
    const product = makeProduct({
      futureSegments: [
        { quantity: 100, date: daysFromNow(5) },
        { quantity: 900, date: daysFromNow(20) },
      ],
    });
    // Janela 30d cobre ambos (1000 ≥ 500) → entra.
    const out = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 30,
      }),
      [],
    );
    expect(out).toHaveLength(1);
  });

  it('chegada cuja 2ª data está na janela CONTA (não subestima)', () => {
    // 1ª chegada distante (60d): 50. 2ª chegada perto (3d): 600.
    const product = makeProduct({
      futureSegments: [
        { quantity: 50, date: daysFromNow(60) },
        { quantity: 600, date: daysFromNow(3) },
      ],
    });
    const out = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(out).toHaveLength(1);
  });

  it('ignora segmentos com quantidade inválida (0, negativa, NaN)', () => {
    const product = makeProduct({
      futureSegments: [
        { quantity: 0, date: daysFromNow(2) },
        { quantity: -100, date: daysFromNow(2) },
        { quantity: Number.NaN, date: daysFromNow(2) },
        { quantity: 600, date: daysFromNow(2) },
      ],
    });
    const out = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(out).toHaveLength(1); // só os 600 válidos contam

    const tooLittle = applyStockFilters(
      [
        makeProduct({
          futureSegments: [
            { quantity: 0, date: daysFromNow(2) },
            { quantity: 100, date: daysFromNow(2) },
          ],
        }),
      ],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(tooLittle).toHaveLength(0);
  });

  it('segmentos são inertes quando o sub-toggle de futuro está OFF (modo estrito)', () => {
    const product = makeProduct({
      availableStock: 100,
      futureSegments: [{ quantity: 900, date: daysFromNow(2) }],
    });
    // Estrito: só os 100 disponíveis contam → 100 < 500 → fora.
    const strict = applyStockFilters(
      [product],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: false,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(strict).toHaveLength(0);
  });

  it('fallback de data única permanece quando não há segmentos', () => {
    const inWindow = makeProduct({
      futureStock: 600,
      expectedReplenishDate: daysFromNow(3),
    });
    const out = applyStockFilters(
      [inWindow],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(out).toHaveLength(1);

    const outOfWindow = makeProduct({
      futureStock: 600,
      expectedReplenishDate: daysFromNow(60),
    });
    const none = applyStockFilters(
      [outOfWindow],
      filters({
        minQuantityNeeded: 500,
        includeFutureStock: true,
        minQtyIncludesFutureStock: true,
        futureStockWindowDays: 7,
      }),
      [],
    );
    expect(none).toHaveLength(0);
  });
});
