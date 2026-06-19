/**
 * stock-filter.edge-cases — Suíte de regressão para normalização/indexação.
 *
 * Garante que NUNCA voltaremos aos bugs:
 *   - case-sensitivity em categoria/fornecedor
 *   - acentuação ignorada
 *   - strings parcialmente correspondentes (substring) que NÃO devem casar em
 *     filtros exatos (categoria/fornecedor/colorName) mas DEVEM casar em search
 *   - listas vazias / universo vazio / variantes sem cor
 *   - whitespace / casing misto em filtros do usuário
 */
import { describe, expect, it } from 'vitest';
import { applyStockFilters, buildStockIndexes, normalize } from '@/lib/inventory/stock-filter';
import { defaultStockFilters, type ProductStockSummary, type VariantStock } from '@/types/stock';

const v = (id: string, color: string | undefined, stock = 100): VariantStock => ({
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
  status: stock > 0 ? 'in_stock' : 'out_of_stock',
  updatedAt: '2026-01-01',
});

const p = (
  id: string,
  name: string,
  cat: string | undefined,
  sup: string | undefined,
  variants: VariantStock[],
): ProductStockSummary => ({
  productId: id,
  productName: name,
  productSku: id.toUpperCase(),
  categoryName: cat,
  supplierName: sup,
  overallStatus: 'in_stock',
  variantsInStock: variants.length,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  availableColors: [],
  totalVariants: variants.length,
  totalCurrentStock: variants.reduce((s, x) => s + x.currentStock, 0),
  totalMinStock: 0,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: variants.reduce((s, x) => s + x.availableStock, 0),
  variants,
});

describe('normalize — função base', () => {
  it.each([
    ['Açaí', 'acai'],
    ['CANETAS', 'canetas'],
    ['  Fornecedor A  ', 'fornecedor a'],
    ['Agêndas', 'agendas'],
    ['Vermêlho', 'vermelho'],
    [undefined, ''],
    [null, ''],
    ['', ''],
  ])('normalize(%j) === %j', (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe('regressão — categoria', () => {
  const universe = [
    p('p1', 'Caneta', 'Canetas', 'A', [v('p1-1', 'Azul')]),
    p('p2', 'Caderno', 'CADERNOS', 'B', [v('p2-1', 'Verde')]),
    p('p3', 'Agenda', 'Agêndas', 'C', [v('p3-1', 'Rosa')]),
    p('p4', 'Mochila', undefined, 'D', [v('p4-1', 'Preto')]),
  ];
  const idx = buildStockIndexes(universe, []);

  it.each([
    ['canetas', ['p1']],
    ['CANETAS', ['p1']],
    ['  canetas  ', ['p1']],
    ['Cadernos', ['p2']],
    ['agendas', ['p3']], // sem acento → casa "Agêndas"
    ['AGÊNDAS', ['p3']],
    ['canetinha', []], // substring NÃO deve casar
    ['', ['p1', 'p2', 'p3', 'p4']], // empty = sem filtro
  ])('categoryId=%j → %j', (categoryId, expected) => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: categoryId || undefined },
      [],
      idx,
    );
    expect(out.map((x) => x.productId).sort()).toEqual(expected.sort());
  });
});

describe('regressão — fornecedor', () => {
  const universe = [
    p('p1', 'X', 'Cat', 'Fornecedor Açaí', [v('p1-1', 'Azul')]),
    p('p2', 'Y', 'Cat', 'fornecedor acai', [v('p2-1', 'Verde')]),
    p('p3', 'Z', 'Cat', 'Outro Fornecedor', [v('p3-1', 'Rosa')]),
  ];
  const idx = buildStockIndexes(universe, []);

  it('acento + case combinados', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, supplierId: 'FORNECEDOR AÇAÍ' },
      [],
      idx,
    );
    expect(out.map((x) => x.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('substring NÃO casa (exato após normalização)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, supplierId: 'fornecedor' },
      [],
      idx,
    );
    expect(out).toEqual([]);
  });
});

describe('regressão — cor', () => {
  const universe = [
    p('p1', 'A', 'C', 'F', [v('p1-1', 'Azul'), v('p1-2', 'Verde')]),
    p('p2', 'B', 'C', 'F', [v('p2-1', 'Azul Marinho')]),
    p('p3', 'C', 'C', 'F', [v('p3-1', undefined)]),
  ];
  const idx = buildStockIndexes(universe, []);

  it('colorName exata NÃO casa por substring (Azul ≠ Azul Marinho)', () => {
    const out = applyStockFilters(universe, { ...defaultStockFilters, colorName: 'Azul' }, [], idx);
    expect(out.map((x) => x.productId)).toEqual(['p1']);
  });

  it('colorGroup casa por substring (Azul ∈ "Azul Marinho")', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, colorGroup: 'Azul' },
      [],
      idx,
    );
    expect(out.map((x) => x.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('variantes sem cor não quebram o índice', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, colorName: 'Verde' },
      [],
      idx,
    );
    expect(out.map((x) => x.productId)).toEqual(['p1']);
  });
});

describe('regressão — listas vazias / borda', () => {
  it('universo vazio retorna []', () => {
    expect(applyStockFilters([], defaultStockFilters, [])).toEqual([]);
  });

  it('filtro sem nenhum match retorna []', () => {
    const universe = [p('p1', 'A', 'Cat', 'F', [v('p1-1', 'Azul')])];
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: 'nada' },
      [],
      buildStockIndexes(universe, []),
    );
    expect(out).toEqual([]);
  });

  it('search vazio + minQty=0 + status=all = identidade do universo', () => {
    const universe = [
      p('p1', 'A', 'C', 'F', [v('p1-1', 'Azul')]),
      p('p2', 'B', 'C', 'F', [v('p2-1', 'Verde')]),
    ];
    const out = applyStockFilters(
      universe,
      defaultStockFilters,
      [],
      buildStockIndexes(universe, []),
    );
    expect(out).toHaveLength(2);
    // sem filtro de cor → variants é a MESMA referência (identidade preservada)
    expect(out[0].variants).toBe(universe.find((x) => x.productId === out[0].productId)!.variants);
  });

  it('search casa por substring (regra diferente de categoria)', () => {
    const universe = [
      p('p1', 'Caneta Azul', 'C', 'F', [v('p1-1', 'Azul')]),
      p('p2', 'Caderno', 'C', 'F', [v('p2-1', 'Verde')]),
    ];
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, search: 'CANE' },
      [],
      buildStockIndexes(universe, []),
    );
    expect(out.map((x) => x.productId)).toEqual(['p1']);
  });
});

describe('regressão — projeção: linha só mostra variantes do filtro', () => {
  const universe = [
    p('p1', 'Multi', 'C', 'F', [
      v('p1-1', 'Azul', 500),
      v('p1-2', 'Verde', 300),
      v('p1-3', 'Vermelho', 200),
    ]),
  ];
  const idx = buildStockIndexes(universe, []);

  it('filtro "Azul" → row.totalVariants = 1 e availableColors só tem Azul', () => {
    const [row] = applyStockFilters(
      universe,
      { ...defaultStockFilters, colorName: 'Azul' },
      [],
      idx,
    );
    expect(row.totalVariants).toBe(1);
    expect(row.variants).toHaveLength(1);
    expect(row.variants[0].colorName).toBe('Azul');
    expect(row.availableColors.map((c) => c.colorName)).toEqual(['Azul']);
    // Badges/contadores não devem reusar dados do produto não filtrado:
    expect(row.totalCurrentStock).toBe(500);
    expect(row.totalAvailableStock).toBe(500);
  });

  it('filtro "Verde" → contadores recalculados (300, não 1000)', () => {
    const [row] = applyStockFilters(
      universe,
      { ...defaultStockFilters, colorName: 'Verde' },
      [],
      idx,
    );
    expect(row.totalCurrentStock).toBe(300);
    expect(row.variantsInStock).toBe(1); // não 3
  });

  it('sem filtro → totais permanecem os do produto original (1000)', () => {
    const [row] = applyStockFilters(universe, defaultStockFilters, [], idx);
    expect(row.totalCurrentStock).toBe(1000);
    expect(row.totalVariants).toBe(3);
  });
});
