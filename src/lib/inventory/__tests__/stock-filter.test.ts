/**
 * Integração: busca por cor + condição de estoque sempre recalcula contagens
 * e variações apenas dentro do filtro selecionado.
 */
import { describe, it, expect } from 'vitest';
import {
  applyStockFilters,
  aggregateVariantTotals,
  buildStockIndexes,
  buildFilterContext,
  normalize,
  selectMatchingVariants,
} from '@/lib/inventory/stock-filter';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockFilters,
  type VariantStock,
} from '@/types/stock';

const v = (over: Partial<VariantStock>): VariantStock => ({
  id: 'vid',
  productId: 'p',
  variantId: 'vid',
  variantSku: 'SKU',
  colorName: 'Azul',
  currentStock: 100,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: 100,
  status: 'in_stock',
  updatedAt: '2026-01-01',
  ...over,
});

const p = (id: string, name: string, variants: VariantStock[]): ProductStockSummary => {
  const totals = aggregateVariantTotals(variants);
  return {
    productId: id,
    productName: name,
    productSku: id.toUpperCase(),
    overallStatus: 'in_stock',
    variantsInStock: variants.filter((x) => x.status === 'in_stock').length,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: variants.filter((x) => x.status === 'out_of_stock').length,
    availableColors: [],
    ...totals,
    variants,
  };
};

const fixture = (): ProductStockSummary[] => [
  p('p1', 'Garrafa térmica 480ml', [
    v({
      id: 'p1-azul',
      variantSku: 'P1-AZ',
      colorName: 'Azul',
      currentStock: 595,
      availableStock: 595,
    }),
    v({
      id: 'p1-rosa',
      variantSku: 'P1-RO',
      colorName: 'Rosa',
      currentStock: 0,
      availableStock: 0,
      status: 'out_of_stock',
    }),
  ]),
  p('p2', 'Garrafa térmica 550ml', [
    v({
      id: 'p2-azul',
      variantSku: 'P2-AZ',
      colorName: 'Azul',
      currentStock: 200,
      availableStock: 200,
    }),
    v({
      id: 'p2-amar',
      variantSku: 'P2-AM',
      colorName: 'Amarelo',
      currentStock: 6,
      availableStock: 6,
    }),
    v({
      id: 'p2-preto',
      variantSku: 'P2-PR',
      colorName: 'Preto',
      currentStock: 0,
      availableStock: 0,
      status: 'out_of_stock',
    }),
  ]),
  p('p3', 'Caneca cerâmica', [
    v({
      id: 'p3-verm',
      variantSku: 'P3-VM',
      colorName: 'Vermelho',
      currentStock: 800,
      availableStock: 800,
    }),
  ]),
];

const withFilters = (over: Partial<StockFilters>): StockFilters => ({
  ...defaultStockFilters,
  sortBy: 'name',
  sortDirection: 'asc',
  ...over,
});

describe('stock-filter — pipeline de seleção/agregação/montagem', () => {
  it('normalize remove acentos e diferencia caixa', () => {
    expect(normalize('Vermélho ')).toBe('vermelho');
    expect(normalize(undefined)).toBe('');
  });

  it('selectMatchingVariants retorna todas as variações quando não há filtro de cor', () => {
    const [prod] = fixture();
    const ctx = buildFilterContext(withFilters({}));
    expect(selectMatchingVariants(prod, ctx)).toHaveLength(prod.variants.length);
  });

  it('cor "azul" filtra para somente variações azuis em cada produto', () => {
    const data = fixture();
    const out = applyStockFilters(data, withFilters({ colorName: 'Azul' }), []);
    expect(out.map((x) => x.productId)).toEqual(['p1', 'p2']);
    for (const prod of out) {
      expect(prod.variants.every((x) => x.colorName === 'Azul')).toBe(true);
      expect(prod.totalVariants).toBe(prod.variants.length);
      expect(prod.availableColors.map((c) => c.colorName)).toEqual(['Azul']);
    }
  });

  it('cor filtrada também recalcula cores visíveis, badges e status da linha agregada', () => {
    const [filtered] = applyStockFilters(fixture(), withFilters({ colorName: 'Azul' }), []);
    expect(filtered.productId).toBe('p1');
    expect(filtered.variants).toHaveLength(1);
    expect(filtered.availableColors).toHaveLength(1);
    expect(filtered.availableColors[0].colorName).toBe('Azul');
    expect(filtered.variantsOutOfStock).toBe(0);
    expect(filtered.variantsCritical).toBe(0);
    expect(filtered.overallStatus).toBe('in_stock');
  });

  it('grupo de cor usa colorGroup quando disponível e projeta só as variações do grupo', () => {
    const data = [
      p('pg', 'Garrafa grupo', [
        v({ id: 'pg-royal', variantSku: 'PG-AZ', colorName: 'Azul Royal', colorGroup: 'Azuis' }),
        v({ id: 'pg-rosa', variantSku: 'PG-RO', colorName: 'Rosa', colorGroup: 'Rosas' }),
      ]),
    ];
    const [filtered] = applyStockFilters(data, withFilters({ colorGroup: 'Azuis' }), []);
    expect(filtered.variants.map((x) => x.id)).toEqual(['pg-royal']);
    expect(filtered.availableColors.map((x) => x.colorName)).toEqual(['Azul Royal']);
  });

  it('"azul" + ≥500un mantém só produtos cujo POOL azul atende — não o total do produto', () => {
    const data = fixture();
    const out = applyStockFilters(
      data,
      withFilters({ colorName: 'Azul', minQuantityNeeded: 500 }),
      [],
    );
    expect(out.map((x) => x.productId)).toEqual(['p1']); // p2 azul=200 não atende
    expect(out[0].totalAvailableStock).toBe(595);
    expect(out[0].totalCurrentStock).toBe(595);
    expect(out[0].totalVariants).toBe(1);
    expect(out[0].variants).toHaveLength(1);
  });

  it('busca por cor ignora acentos e caixa', () => {
    const data = [p('px', 'X', [v({ colorName: 'Vermélho', variantSku: 'X-VM' })])];
    const out = applyStockFilters(data, withFilters({ search: 'vermelho' }), []);
    expect(out).toHaveLength(1);
  });

  it('totais agregados são recalculados apenas com variações do filtro', () => {
    const data = fixture();
    const filtered = applyStockFilters(data, withFilters({ colorName: 'Azul' }), []);
    const p2 = filtered.find((x) => x.productId === 'p2')!;
    expect(p2.totalCurrentStock).toBe(200);
    expect(p2.totalAvailableStock).toBe(200);
    expect(p2.variants.every((x) => x.colorName === 'Azul')).toBe(true);
  });

  it('sem filtro de cor, variants do produto são preservadas (não mutadas)', () => {
    const data = fixture();
    const out = applyStockFilters(data, withFilters({}), []);
    const original = data.find((x) => x.productId === 'p1')!;
    const filtered = out.find((x) => x.productId === 'p1')!;
    expect(filtered.variants).toBe(original.variants);
    expect(filtered.totalVariants).toBe(original.totalVariants);
  });

  it('buildStockIndexes monta byColorNameN normalizado e fast-path retorna vazio se ausente', () => {
    const data = fixture();
    const idx = buildStockIndexes(data);
    expect(idx.byColorNameN.get('azul')?.size).toBe(2);
    const empty = applyStockFilters(data, withFilters({ colorName: 'Inexistente' }), [], idx);
    expect(empty).toEqual([]);
  });

  it('status filter respeita variações projetadas quando cor está ativa', () => {
    const data = fixture();
    // Em "azul", p1 só tem variação in_stock — filtro out_of_stock não deve trazer
    const out = applyStockFilters(
      data,
      withFilters({ colorName: 'Azul', status: 'out_of_stock' }),
      [],
    );
    expect(out).toEqual([]);
  });

  it('idempotência: mesma entrada → mesma saída (estável entre chamadas)', () => {
    const data = fixture();
    const filters = withFilters({ colorName: 'Azul', minQuantityNeeded: 500 });
    const a = applyStockFilters(data, filters, []);
    const b = applyStockFilters(data, filters, []);
    expect(a).toEqual(b);
  });

  it('reuso de índice entre múltiplas paginações/filtros não corrompe resultado', () => {
    const data = fixture();
    const idx = buildStockIndexes(data);
    const r1 = applyStockFilters(data, withFilters({ colorName: 'Azul' }), [], idx);
    const r2 = applyStockFilters(data, withFilters({ colorName: 'Amarelo' }), [], idx);
    const r3 = applyStockFilters(data, withFilters({ colorName: 'Azul' }), [], idx);
    expect(r1.map((x) => x.productId)).toEqual(['p1', 'p2']);
    expect(r2.map((x) => x.productId)).toEqual(['p2']);
    expect(r3).toEqual(r1);
  });

  it('performance: 500 produtos × 5 variações filtra em <50ms com índice', () => {
    const big: ProductStockSummary[] = Array.from({ length: 500 }, (_, i) =>
      p(`b${i}`, `Produto ${i}`, [
        v({ id: `b${i}-azul`, variantSku: `B${i}-AZ`, colorName: 'Azul', availableStock: 600 }),
        v({ id: `b${i}-rosa`, variantSku: `B${i}-RO`, colorName: 'Rosa', availableStock: 50 }),
        v({ id: `b${i}-verde`, variantSku: `B${i}-VD`, colorName: 'Verde', availableStock: 10 }),
        v({
          id: `b${i}-preto`,
          variantSku: `B${i}-PR`,
          colorName: 'Preto',
          availableStock: 0,
          status: 'out_of_stock',
        }),
        v({ id: `b${i}-amar`, variantSku: `B${i}-AM`, colorName: 'Amarelo', availableStock: 5 }),
      ]),
    );
    const idx = buildStockIndexes(big);
    const t0 = performance.now();
    const out = applyStockFilters(
      big,
      withFilters({ colorName: 'Azul', minQuantityNeeded: 500 }),
      [],
      idx,
    );
    const dt = performance.now() - t0;
    expect(out).toHaveLength(500);
    expect(out[0].variants).toHaveLength(1);
    expect(dt).toBeLessThan(50);
  });

  describe('matchMinQuantity — Estoque Futuro vs régua estrita', () => {
    // Produto com variação verde: 0 disponível agora, 600 chegando em 10 dias.
    const futureFixture = (): ProductStockSummary[] => {
      const inTen = new Date(Date.now() + 10 * 86_400_000).toISOString();
      return [
        p('px', 'Chaveiro verde', [
          v({
            id: 'px-verde',
            variantSku: 'PX-VD',
            colorName: 'Verde',
            currentStock: 0,
            availableStock: 0,
            status: 'out_of_stock',
            futureStock: 600,
            expectedReplenishDate: inTen,
          } as Partial<VariantStock>),
        ]),
      ];
    };

    it('Estoque Futuro 30d ON + sub-toggle OFF → régua estrita ignora futuro (oculta produto)', () => {
      const out = applyStockFilters(
        futureFixture(),
        withFilters({
          colorName: 'Verde',
          minQuantityNeeded: 500,
          includeFutureStock: true,
          futureStockWindowDays: 30,
          minQtyIncludesFutureStock: false,
        }),
        [],
      );
      expect(out).toHaveLength(0);
    });

    it('Estoque Futuro 30d ON + sub-toggle ON → soma futuro ao pool (inclui produto)', () => {
      const out = applyStockFilters(
        futureFixture(),
        withFilters({
          colorName: 'Verde',
          minQuantityNeeded: 500,
          includeFutureStock: true,
          futureStockWindowDays: 30,
          minQtyIncludesFutureStock: true,
        }),
        [],
      );
      expect(out).toHaveLength(1);
    });

    it('Sub-toggle ON mas Estoque Futuro OFF → continua estrito (toggle global é pré-requisito)', () => {
      const out = applyStockFilters(
        futureFixture(),
        withFilters({
          colorName: 'Verde',
          minQuantityNeeded: 500,
          includeFutureStock: false,
          minQtyIncludesFutureStock: true,
        }),
        [],
      );
      expect(out).toHaveLength(0);
    });

    it('Reposição fora da janela (40d com janela 30d) NÃO entra mesmo com sub-toggle ON', () => {
      const inForty = new Date(Date.now() + 40 * 86_400_000).toISOString();
      const data: ProductStockSummary[] = [
        p('py', 'Garrafa verde', [
          v({
            id: 'py-verde',
            variantSku: 'PY-VD',
            colorName: 'Verde',
            currentStock: 0,
            availableStock: 0,
            status: 'out_of_stock',
            futureStock: 600,
            expectedReplenishDate: inForty,
          } as Partial<VariantStock>),
        ]),
      ];
      const out = applyStockFilters(
        data,
        withFilters({
          colorName: 'Verde',
          minQuantityNeeded: 500,
          includeFutureStock: true,
          futureStockWindowDays: 30,
          minQtyIncludesFutureStock: true,
        }),
        [],
      );
      expect(out).toHaveLength(0);
    });
  });
});
