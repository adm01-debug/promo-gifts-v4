/**
 * Regressão SSOT — consistência cross-filtro dos status `critical` e
 * `low_stock` entre StockDashboard (KPIs) e VariantStockTable (chips).
 *
 * Cenário coberto:
 *   - Alternar filtros (categoria, fornecedor, cor) NÃO pode quebrar
 *     a igualdade `KPI(status) === Σ chips(status)` na tabela.
 *   - Caso recorrente: filtrar por cor recomputava counters do produto
 *     projetado mas o dashboard somava contadores brutos — o chip
 *     "Crítico" sumia da tabela mas o KPI continuava aceso.
 *
 * Estratégia:
 *   - Usa o pipeline real (`applyStockFilters` + `buildStockIndexes`)
 *     como SSOT da projeção.
 *   - Recomputa o summary a partir dos produtos projetados com a
 *     MESMA lógica do `useVariantStock` (switch sobre `v.status`).
 *
 * Nota — semântica do filtro `status` (sem variant-filter):
 *   `matchStatus` filtra PRODUTOS (não variações). Quando há produto
 *   com status crítico, todas as variações dele continuam visíveis.
 *   O contrato verdadeiro: a projeção só "estreita" variações quando
 *   há `colorName`/`colorGroup` (hasVariantFilter=true).
 */
import { describe, it, expect } from 'vitest';
import { applyStockFilters, buildStockIndexes } from '@/lib/inventory/stock-filter';
import { defaultStockFilters, type ProductStockSummary, type VariantStock } from '@/types/stock';

const v = (
  id: string,
  productId: string,
  colorName: string,
  status: VariantStock['status'],
  currentStock = 5,
): VariantStock => ({
  id,
  productId,
  variantId: id,
  variantSku: `SKU-${id}`,
  colorName,
  colorHex: '#000',
  currentStock,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: currentStock,
  status,
  updatedAt: '2026-01-01',
});

const mkProduct = (
  id: string,
  category: string,
  supplier: string,
  variants: VariantStock[],
  overallStatus: ProductStockSummary['overallStatus'],
): ProductStockSummary => ({
  productId: id,
  productName: `Produto ${id}`,
  productSku: id.toUpperCase(),
  categoryName: category,
  supplierName: supplier,
  overallStatus,
  variantsInStock: variants.filter((x) => x.status === 'in_stock').length,
  variantsLowStock: variants.filter((x) => x.status === 'low_stock').length,
  variantsCritical: variants.filter((x) => x.status === 'critical').length,
  variantsOutOfStock: variants.filter((x) => x.status === 'out_of_stock').length,
  availableColors: [],
  totalVariants: variants.length,
  totalCurrentStock: variants.reduce((s, x) => s + x.currentStock, 0),
  totalMinStock: variants.length * 10,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: variants.reduce((s, x) => s + x.availableStock, 0),
  variants,
});

/**
 * Espelho exato do switch em `useVariantStock.ts` (linhas 90–103).
 * Mantido inline para que mudanças no hook quebrem esta regressão
 * explicitamente — não importamos a função para preservar a guarda.
 */
function recomputeChipCounts(projected: ProductStockSummary[]) {
  let inStock = 0,
    lowStock = 0,
    critical = 0,
    outOfStock = 0;
  for (const p of projected) {
    for (const x of p.variants) {
      switch (x.status) {
        case 'in_stock':
          inStock++;
          break;
        case 'low_stock':
          lowStock++;
          break;
        case 'critical':
          critical++;
          break;
        case 'out_of_stock':
          outOfStock++;
          break;
      }
    }
  }
  return { inStock, lowStock, critical, outOfStock };
}

// Mundo de teste: 3 categorias × 2 fornecedores × 3 cores × 4 status
const products: ProductStockSummary[] = [
  mkProduct(
    'p1',
    'Canecas',
    'Acme',
    [
      v('p1a', 'p1', 'Azul', 'critical', 2),
      v('p1b', 'p1', 'Verde', 'low_stock', 8),
      v('p1c', 'p1', 'Vermelho', 'in_stock', 50),
    ],
    'critical',
  ),
  mkProduct(
    'p2',
    'Canecas',
    'Globex',
    [v('p2a', 'p2', 'Azul', 'low_stock', 9), v('p2b', 'p2', 'Verde', 'out_of_stock', 0)],
    'low_stock',
  ),
  mkProduct(
    'p3',
    'Garrafas',
    'Acme',
    [v('p3a', 'p3', 'Azul', 'critical', 1), v('p3b', 'p3', 'Vermelho', 'in_stock', 200)],
    'critical',
  ),
  mkProduct(
    'p4',
    'Garrafas',
    'Globex',
    [v('p4a', 'p4', 'Verde', 'out_of_stock', 0), v('p4b', 'p4', 'Vermelho', 'low_stock', 5)],
    'out_of_stock',
  ),
  mkProduct(
    'p5',
    'Mochilas',
    'Acme',
    [v('p5a', 'p5', 'Azul', 'in_stock', 100), v('p5b', 'p5', 'Verde', 'critical', 3)],
    'in_stock',
  ),
];

const idx = buildStockIndexes(products);

describe('Cross-filter KPI ↔ chip — critical & low_stock', () => {
  it('baseline (sem filtros) — todas as variações projetadas', () => {
    const out = applyStockFilters(products, defaultStockFilters, [], idx);
    const c = recomputeChipCounts(out);
    expect(c.critical).toBe(3); // p1a, p3a, p5b
    expect(c.lowStock).toBe(3); // p1b, p2a, p4b
    expect(c.outOfStock).toBe(2); // p2b, p4a
    expect(c.inStock).toBe(3); // p1c, p3b, p5a
  });

  it('categoryId=Canecas — produtos p1 e p2 com TODAS suas variações', () => {
    const out = applyStockFilters(
      products,
      { ...defaultStockFilters, categoryId: 'Canecas' },
      [],
      idx,
    );
    const c = recomputeChipCounts(out);
    // p1: crit/low/in   p2: low/out
    expect(c.critical).toBe(1);
    expect(c.lowStock).toBe(2);
    expect(c.outOfStock).toBe(1);
    expect(c.inStock).toBe(1);
  });

  it('supplierId=Acme — produtos p1, p3, p5 com TODAS suas variações', () => {
    const out = applyStockFilters(
      products,
      { ...defaultStockFilters, supplierId: 'Acme' },
      [],
      idx,
    );
    const c = recomputeChipCounts(out);
    // p1: crit/low/in   p3: crit/in   p5: in/crit
    expect(c.critical).toBe(3);
    expect(c.lowStock).toBe(1);
    expect(c.outOfStock).toBe(0);
    expect(c.inStock).toBe(3);
  });

  it('colorName=Azul — projeção real: apenas variações Azul restam', () => {
    const out = applyStockFilters(products, { ...defaultStockFilters, colorName: 'Azul' }, [], idx);
    const c = recomputeChipCounts(out);
    // Azul: p1a(crit), p2a(low), p3a(crit), p5a(in)
    expect(c.critical).toBe(2);
    expect(c.lowStock).toBe(1);
    expect(c.outOfStock).toBe(0);
    expect(c.inStock).toBe(1);
  });

  it('combo categoryId=Garrafas + colorName=Vermelho — projeção exata', () => {
    const out = applyStockFilters(
      products,
      {
        ...defaultStockFilters,
        categoryId: 'Garrafas',
        colorName: 'Vermelho',
      },
      [],
      idx,
    );
    const c = recomputeChipCounts(out);
    // Garrafas+Vermelho: p3b(in 200), p4b(low 5)
    expect(c.inStock).toBe(1);
    expect(c.lowStock).toBe(1);
    expect(c.critical).toBe(0);
    expect(c.outOfStock).toBe(0);
  });

  it('combo supplierId=Globex + colorName=Verde — projeção exata', () => {
    const out = applyStockFilters(
      products,
      {
        ...defaultStockFilters,
        supplierId: 'Globex',
        colorName: 'Verde',
      },
      [],
      idx,
    );
    const c = recomputeChipCounts(out);
    // Globex+Verde: p2b(out 0), p4a(out 0)
    expect(c.outOfStock).toBe(2);
    expect(c.critical).toBe(0);
    expect(c.lowStock).toBe(0);
    expect(c.inStock).toBe(0);
  });

  it('status=critical (sem variant-filter) — produtos críticos NÃO podem ser zerados', () => {
    // Invariante: ao clicar no KPI "Crítico", a tabela deve ter ≥1
    // variação crítica visível em cada produto retornado.
    const out = applyStockFilters(
      products,
      { ...defaultStockFilters, status: 'critical' },
      [],
      idx,
    );
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      const hasCriticalChip = p.variants.some((x) => x.status === 'critical');
      expect(hasCriticalChip).toBe(true);
    }
  });

  it('status=low_stock + colorName=Verde — projeção: só Verde low_stock', () => {
    const out = applyStockFilters(
      products,
      {
        ...defaultStockFilters,
        status: 'low_stock',
        colorName: 'Verde',
      },
      [],
      idx,
    );
    const c = recomputeChipCounts(out);
    // Verde+low: p1b(low 8) e p5b(crit 3) — `matchStatus` aceita
    // crítico quando o filtro pede `low_stock` (severidade ≥ low),
    // então o produto p5 passa e sua variação Verde crítica é
    // projetada. Documenta a regra "crítico é um sub-caso de baixo".
    expect(c.lowStock).toBe(1);
    expect(c.critical).toBe(1);
    expect(c.outOfStock).toBe(0);
    expect(c.inStock).toBe(0);
  });
});
