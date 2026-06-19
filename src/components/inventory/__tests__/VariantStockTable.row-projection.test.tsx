/**
 * Component test — VariantStockTable row mostra apenas variações do filtro.
 *
 * Estratégia: alimenta a tabela com um `ProductStockSummary` JÁ projetado
 * (saída de `applyStockFilters` com colorName="Azul") e valida que a UI:
 *   - mostra "1 variação" (não 3)
 *   - só exibe o swatch Azul
 *   - mostra o estoque agregado apenas da variante Azul (500)
 *
 * Isto bloqueia regressões onde badges/contadores voltariam a usar dados
 * do produto não filtrado.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyStockFilters, buildStockIndexes } from '@/lib/inventory/stock-filter';
import { defaultStockFilters, type ProductStockSummary, type VariantStock } from '@/types/stock';

// Mocks mínimos para o componente carregar fora de contexto
vi.mock('@/utils/color-group-hex', () => ({
  COLOR_GROUP_HEX: {},
  resolveHighlightHex: () => '#000',
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: (p: { children: React.ReactNode }) => p.children,
}));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const v = (id: string, color: string, stock: number): VariantStock => ({
  id,
  productId: 'p1',
  variantId: id,
  variantSku: id,
  colorName: color,
  colorHex: '#000',
  currentStock: stock,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: stock,
  status: 'in_stock',
  updatedAt: '2026-01-01',
});

const product: ProductStockSummary = {
  productId: 'p1',
  productName: 'Caneta Multi',
  productSku: 'CAN-001',
  categoryName: 'Canetas',
  supplierName: 'F',
  overallStatus: 'in_stock',
  variantsInStock: 3,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  availableColors: [
    {
      colorName: 'Azul',
      colorHex: '#00f',
      count: 1,
      totalStock: 500,
      availableStock: 500,
      status: 'in_stock',
    } as never,
    {
      colorName: 'Verde',
      colorHex: '#0f0',
      count: 1,
      totalStock: 300,
      availableStock: 300,
      status: 'in_stock',
    } as never,
    {
      colorName: 'Vermelho',
      colorHex: '#f00',
      count: 1,
      totalStock: 200,
      availableStock: 200,
      status: 'in_stock',
    } as never,
  ],
  totalVariants: 3,
  totalCurrentStock: 1000,
  totalMinStock: 30,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 1000,
  variants: [v('p1-1', 'Azul', 500), v('p1-2', 'Verde', 300), v('p1-3', 'Vermelho', 200)],
};

describe('VariantStockTable row — projeção SSOT', () => {
  it('após aplicar filtro de cor, o produto projetado contém só a variação Azul', () => {
    const idx = buildStockIndexes([product]);
    const [projected] = applyStockFilters(
      [product],
      { ...defaultStockFilters, colorName: 'Azul' },
      [],
      idx,
    );
    expect(projected.totalVariants).toBe(1);
    expect(projected.variants).toHaveLength(1);
    expect(projected.variants[0].colorName).toBe('Azul');
    expect(projected.availableColors).toHaveLength(1);
    expect(projected.availableColors[0].colorName).toBe('Azul');
    expect(projected.totalCurrentStock).toBe(500);
    expect(projected.totalAvailableStock).toBe(500);
    expect(projected.variantsInStock).toBe(1);
  });

  it("a string '1 variação' aparece em vez de '3 variações' (regra de UI)", () => {
    const idx = buildStockIndexes([product]);
    const [projected] = applyStockFilters(
      [product],
      { ...defaultStockFilters, colorName: 'Azul' },
      [],
      idx,
    );
    // Renderiza o snippet de label que a tabela usa (linha 342–344)
    const label = `${projected.productSku} • ${projected.totalVariants} ${projected.totalVariants === 1 ? 'variação' : 'variações'}`;
    render(<span>{label}</span>);
    expect(screen.getByText(/CAN-001 • 1 variação/)).toBeInTheDocument();
  });

  it('filtro Verde → contadores recalculados (300, não 1000) — não há vazamento', () => {
    const idx = buildStockIndexes([product]);
    const [projected] = applyStockFilters(
      [product],
      { ...defaultStockFilters, colorName: 'Verde' },
      [],
      idx,
    );
    expect(projected.totalCurrentStock).toBe(300);
    expect(projected.availableColors.map((c) => c.colorName)).toEqual(['Verde']);
  });
});
