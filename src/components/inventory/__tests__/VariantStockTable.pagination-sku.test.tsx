/**
 * Contrato de PAGINAÇÃO SKU-first do módulo Estoque:
 *  - A unidade de paginação é o SKU (variação), não o produto-pai.
 *  - 1 produto com 60 variações => página 1 mostra 50 linhas (PAGE_SIZE),
 *    e a 60ª variação cai na página 2 (o produto "divide" entre páginas).
 *  - O contador fala em "variações" e reconcilia com o total de SKUs.
 *
 * Guarda de regressão: no modelo antigo (paginação por produto) 1 produto = 1
 * página e TODAS as 60 variações renderizariam na página 1 — este teste falharia.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariantStockTable } from '@/components/inventory/VariantStockTable';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

vi.mock('@/utils/color-group-hex', () => ({
  COLOR_GROUP_HEX: {},
  resolveHighlightHex: () => '#000',
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: (p: { children: React.ReactNode }) => p.children,
}));
// QuickViewThumb calls useQuery internally — stub to avoid needing QueryClientProvider.
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: () => null,
}));

const mkVariant = (i: number): VariantStock =>
  ({
    id: `v${i}`,
    productId: 'p1',
    variantId: `v${i}`,
    variantSku: `SKU-${i}`,
    colorName: `Cor ${i}`,
    colorHex: '#abc',
    currentStock: 100,
    minStock: 10,
    reservedStock: 0,
    inTransitStock: 0,
    availableStock: 100,
    status: 'in_stock',
    updatedAt: '2026-01-01',
  }) as VariantStock;

const product: ProductStockSummary = {
  productId: 'p1',
  productName: 'Caneca Mega',
  productSku: 'CAN-001',
  categoryName: 'Canecas',
  supplierName: 'F1',
  overallStatus: 'in_stock',
  variantsInStock: 60,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 0,
  availableColors: [],
  totalVariants: 60,
  totalCurrentStock: 6000,
  totalMinStock: 600,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 6000,
  variants: Array.from({ length: 60 }, (_, i) => mkVariant(i)),
} as ProductStockSummary;

describe('VariantStockTable — paginação SKU-first', () => {
  beforeEach(() => window.localStorage.clear());

  it('página 1 mostra 50 SKUs de um produto com 60 variações (split entre páginas)', () => {
    render(<VariantStockTable products={[product]} />);
    const skuCells = screen.getAllByText(/^SKU-\d+$/);
    expect(skuCells).toHaveLength(50);
    // 1ª variação visível, 60ª (índice 59) empurrada para a página 2:
    expect(screen.queryByText('SKU-0')).toBeInTheDocument();
    expect(screen.queryByText('SKU-59')).not.toBeInTheDocument();
  });

  it('contador reconcilia em SKUs ("1–50 de 60 variações")', () => {
    render(<VariantStockTable products={[product]} />);
    const counter = screen.getByText(
      (_t, el) => el?.tagName === 'SPAN' && /1[–-]50 de 60 variações/.test(el.textContent || ''),
    );
    expect(counter).toBeInTheDocument();
  });
});
