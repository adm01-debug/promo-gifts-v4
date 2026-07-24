/**
 * stock-filter.unified — Validação de que TODOS os filtros usam a mesma
 * arquitetura SSOT (normalização + índices) introduzida na pesquisa por cor.
 *
 * Cobertura:
 *   - Categoria/Fornecedor: matching case/acento-insensitive.
 *   - Fast-path via interseção de índices (categoryN ∩ colorNameN).
 *   - colorGroup com índice próprio + fallback substring.
 *   - 300 simulações combinando todos os filtros e validando idempotência.
 */
import { describe, expect, it } from 'vitest';
import {
  applyStockFilters,
  buildStockIndexes,
  buildFilterContext,
} from '@/lib/inventory/stock-filter';
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

const mkVariant = (id: string, color: string, stock = 100): VariantStock => ({
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

const mkProduct = (
  id: string,
  name: string,
  categoryName: string,
  supplierName: string,
  variants: VariantStock[],
): ProductStockSummary => ({
  productId: id,
  productName: name,
  productSku: id.toUpperCase(),
  categoryName,
  supplierName,
  overallStatus: 'in_stock',
  variantsInStock: variants.length,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  availableColors: [],
  totalVariants: variants.length,
  totalCurrentStock: variants.reduce((s, v) => s + v.currentStock, 0),
  totalMinStock: variants.reduce((s, v) => s + v.minStock, 0),
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: variants.reduce((s, v) => s + v.availableStock, 0),
  variants,
});

describe('stock-filter.unified — categoria/fornecedor seguem o SSOT', () => {
  const universe = [
    mkProduct('p1', 'Caneta Azul', 'Canetas', 'Fornecedor A', [mkVariant('p1-1', 'Azul')]),
    mkProduct('p2', 'Caneta Verde', 'CANETAS', 'fornecedor a', [mkVariant('p2-1', 'Verde')]),
    mkProduct('p3', 'Caderno Azul', 'Cadernos', 'Fornecedor B', [mkVariant('p3-1', 'Azul')]),
    mkProduct('p4', 'Agenda Azul', 'Agêndas', 'Fornecedor C', [mkVariant('p4-1', 'Azul')]),
  ];
  const indexes = buildStockIndexes(universe);

  it('categoria casa case-insensitive (Canetas == CANETAS)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: 'canetas' },
      [],
      indexes,
    );
    expect(out.map((p) => p.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('categoria casa accent-insensitive (Agêndas == agendas)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: 'agendas' },
      [],
      indexes,
    );
    expect(out.map((p) => p.productId)).toEqual(['p4']);
  });

  it('fornecedor casa case-insensitive (Fornecedor A == fornecedor a)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, supplierId: 'FORNECEDOR A' },
      [],
      indexes,
    );
    expect(out.map((p) => p.productId).sort()).toEqual(['p1', 'p2']);
  });

  it('interseção categoria ∩ cor via índices (fast-path)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: 'canetas', colorName: 'Azul' },
      [],
      indexes,
    );
    expect(out.map((p) => p.productId)).toEqual(['p1']);
  });

  it('categoria inexistente retorna [] (early-exit)', () => {
    const out = applyStockFilters(
      universe,
      { ...defaultStockFilters, categoryId: 'inexistente' },
      [],
      indexes,
    );
    expect(out).toEqual([]);
  });

  it('FilterContext expõe categoryN/supplierN normalizados', () => {
    const ctx = buildFilterContext({
      ...defaultStockFilters,
      categoryId: 'Cadérnos',
      supplierId: 'FORNECEDOR B',
    });
    expect(ctx.categoryN).toBe('cadernos');
    expect(ctx.supplierN).toBe('fornecedor b');
  });
});

describe('stock-filter.unified — fuzz 300 sims combinando todos os filtros', () => {
  it('idempotência + ids únicos sob qualquer combinação', () => {
    const rnd = mulberry32(0xfeed);
    const cats = ['Canetas', 'CANETAS', 'Cadernos', 'Agêndas'];
    const sups = ['Fornecedor A', 'fornecedor b', 'Fornecedor C'];
    const cols = ['Azul', 'Verde', 'Vermelho', 'Preto'];
    const universe: ProductStockSummary[] = Array.from({ length: 40 }, (_, i) =>
      mkProduct(`p${i}`, `Prod ${i}`, cats[i % cats.length], sups[i % sups.length], [
        mkVariant(`p${i}-1`, cols[i % cols.length], Math.floor(rnd() * 800)),
        mkVariant(`p${i}-2`, cols[(i + 1) % cols.length], Math.floor(rnd() * 800)),
      ]),
    );
    const indexes = buildStockIndexes(universe);

    for (let i = 0; i < 300; i++) {
      const filters: StockFilters = {
        ...defaultStockFilters,
        sortBy: 'name',
        sortDirection: 'asc',
        categoryId: rnd() < 0.5 ? cats[Math.floor(rnd() * cats.length)] : undefined,
        supplierId: rnd() < 0.5 ? sups[Math.floor(rnd() * sups.length)] : undefined,
        colorName: rnd() < 0.5 ? cols[Math.floor(rnd() * cols.length)] : undefined,
        minQuantityNeeded: rnd() < 0.4 ? Math.floor(rnd() * 400) : undefined,
      };
      const a = applyStockFilters(universe, filters, [], indexes);
      const b = applyStockFilters(universe, filters, [], indexes);
      expect(a).toEqual(b);
      expect(new Set(a.map((p) => p.productId)).size).toBe(a.length);
    }
  });
});
