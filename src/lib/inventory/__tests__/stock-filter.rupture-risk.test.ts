/**
 * stock-filter.rupture-risk — Paridade card "Risco de Ruptura" ↔ filtro da tabela.
 *
 * Invariantes garantidas:
 *  1. Quando `ruptureRiskVariantIds` está populado, SOMENTE variações no set aparecem.
 *  2. Variações com estoque OK (in_stock), zeradas (out_of_stock) ou OK-críticas
 *     que NÃO estão no set não aparecem na saída.
 *  3. A contagem de variantes na saída == quantidade de variantes únicas do set
 *     que existem no universo (paridade card-count ↔ linhas-filtradas).
 *  4. Set vazio/undefined ⇒ comportamento legado (filtro `status` aplica normalmente).
 *  5. Fallback feature-flag-off: filters.status='critical' continua filtrando por
 *     overallStatus==='critical' (comportamento legado preservado).
 */
import { describe, expect, it } from 'vitest';
import { applyStockFilters } from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type VariantStock,
} from '@/types/stock';

const mkVariant = (
  id: string,
  color: string,
  stock: number,
  status: VariantStock['status'] = stock > 0 ? 'in_stock' : 'out_of_stock',
): VariantStock => ({
  id,
  productId: id.split('-')[0],
  variantId: id,
  variantSku: id.toUpperCase(),
  colorName: color,
  currentStock: stock,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: stock,
  status,
  updatedAt: '2026-01-01',
});

const mkProduct = (
  id: string,
  name: string,
  variants: VariantStock[],
  overallStatus: ProductStockSummary['overallStatus'] = 'in_stock',
): ProductStockSummary => ({
  productId: id,
  productName: name,
  productSku: id.toUpperCase(),
  categoryName: 'Geral',
  supplierName: 'Fornecedor X',
  overallStatus,
  variantsInStock: variants.filter((v) => v.status === 'in_stock').length,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: variants.filter((v) => v.status === 'out_of_stock').length,
  availableColors: [],
  totalVariants: variants.length,
  totalCurrentStock: variants.reduce((s, v) => s + v.currentStock, 0),
  totalMinStock: variants.reduce((s, v) => s + v.minStock, 0),
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: variants.reduce((s, v) => s + v.availableStock, 0),
  variants,
});

describe('stock-filter — Risco de Ruptura (ruptureRiskVariantIds)', () => {
  const universe: ProductStockSummary[] = [
    // p1: tem 1 variação em risco (azul) + 1 em estoque OK (verde) + 1 zerada (vermelho)
    mkProduct('p1', 'Caneta', [
      mkVariant('p1-azul', 'Azul', 5, 'in_stock'),
      mkVariant('p1-verde', 'Verde', 200, 'in_stock'),
      mkVariant('p1-vermelho', 'Vermelho', 0, 'out_of_stock'),
    ]),
    // p2: 100% em estoque, NENHUMA em risco
    mkProduct('p2', 'Caderno', [
      mkVariant('p2-azul', 'Azul', 500, 'in_stock'),
      mkVariant('p2-verde', 'Verde', 300, 'in_stock'),
    ]),
    // p3: tem 1 variação em risco (preto)
    mkProduct('p3', 'Agenda', [
      mkVariant('p3-preto', 'Preto', 2, 'in_stock'),
      mkVariant('p3-branco', 'Branco', 800, 'in_stock'),
    ]),
  ];

  const ruptureSet: ReadonlySet<string> = new Set(['p1-azul', 'p3-preto']);

  it('mostra APENAS variações cujo variantId está no set de risco', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
      [],
    );
    const variantIds = out.flatMap((p) => p.variants.map((v) => v.variantId));
    expect(variantIds.sort()).toEqual(['p1-azul', 'p3-preto']);
  });

  it('NÃO inclui variações em estoque OK que não estão no set', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
      [],
    );
    const all = out.flatMap((p) => p.variants.map((v) => v.variantId));
    expect(all).not.toContain('p1-verde'); // OK
    expect(all).not.toContain('p2-azul'); // OK
    expect(all).not.toContain('p3-branco'); // OK
  });

  it('NÃO inclui variações zeradas que não estão no set', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
      [],
    );
    const all = out.flatMap((p) => p.variants.map((v) => v.variantId));
    expect(all).not.toContain('p1-vermelho'); // zerada, fora do set
  });

  it('exclui produtos sem nenhuma variação em risco (p2)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
      [],
    );
    expect(out.map((p) => p.productId).sort()).toEqual(['p1', 'p3']);
  });

  it('paridade: linhas-filtradas (variantes) == cardinalidade do set', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet },
      [],
    );
    const variantCount = out.reduce((sum, p) => sum + p.variants.length, 0);
    expect(variantCount).toBe(ruptureSet.size);
  });

  it('estado vazio: set válido sem matches → lista vazia (sem crash)', () => {
    const out = applyStockFilters(
      universe,
      {
        ...defaultStockFilters,
        ruptureRiskVariantIds: new Set(['inexistente-1', 'inexistente-2']),
      },
      [],
    );
    expect(out).toEqual([]);
  });

  it('set vazio é tratado como ausente — comportamento legado', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: new Set<string>() },
      [],
    );
    // sem filtro de status, retorna tudo
    expect(out.length).toBe(universe.length);
  });

  it('fallback (flag off): filters.status=critical filtra por overallStatus', () => {
    const universeCritical: ProductStockSummary[] = [
      mkProduct('c1', 'Crítico A', [mkVariant('c1-x', 'X', 1)], 'critical'),
      mkProduct('c2', 'Normal', [mkVariant('c2-y', 'Y', 500)], 'in_stock'),
    ];
    const out = applyStockFilters(
      universeCritical,
      { ...defaultStockFilters, status: 'critical' },
      [],
    );
    expect(out.map((p) => p.productId)).toEqual(['c1']);
  });

  it('outros filtros (search) coexistem com ruptureRiskVariantIds', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, ruptureRiskVariantIds: ruptureSet, search: 'agenda' },
      [],
    );
    expect(out.map((p) => p.productId)).toEqual(['p3']);
    expect(out[0].variants.map((v) => v.variantId)).toEqual(['p3-preto']);
  });
});
