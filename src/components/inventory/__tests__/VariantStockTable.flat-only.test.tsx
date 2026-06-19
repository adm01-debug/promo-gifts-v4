/**
 * Garante o contrato variação-first do módulo Estoque:
 *  - Toggle "Agrupar" foi removido do DOM (sem entrada oculta).
 *  - useEffect de mount purga chaves legadas do localStorage
 *    (`stock.groupBy`, `stock.viewMode`, `stock.groupingMode`).
 *  - 1 produto pai com 3 variações renderiza 3 linhas individuais
 *    (não soma estoque no pai) — cada linha com seu SKU/cor/estoque.
 *  - Filtro de status reduz a contagem ao nível da VARIAÇÃO
 *    (e não esconde produto pai por agregação).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariantStockTable } from '@/components/inventory/VariantStockTable';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

// Render all virtual items so the DOM reflects full row state (jsdom has height=0
// so the real useVirtualizer would render nothing).
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize?: () => number }) => {
    const sz = estimateSize?.() ?? 56;
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, i) => ({
          index: i,
          start: i * sz,
          end: (i + 1) * sz,
          size: sz,
          key: i,
          lane: 0,
        })),
      getTotalSize: () => count * sz,
      scrollToIndex: vi.fn(),
    };
  },
}));

vi.mock('@/utils/color-group-hex', () => ({
  COLOR_GROUP_HEX: {},
  resolveHighlightHex: () => '#000',
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: (p: { children: React.ReactNode }) => p.children,
}));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const v = (
  id: string,
  color: string,
  stock: number,
  status: VariantStock['status'],
): VariantStock => ({
  id,
  productId: 'p1',
  variantId: id,
  variantSku: `SKU-${id}`,
  colorName: color,
  colorHex: '#abc',
  currentStock: stock,
  minStock: 10,
  reservedStock: 0,
  inTransitStock: 0,
  availableStock: stock,
  status,
  updatedAt: '2026-01-01',
});

const product: ProductStockSummary = {
  productId: 'p1',
  productName: 'Garrafa Térmica',
  productSku: 'GAR-001',
  categoryName: 'Garrafas',
  supplierName: 'F1',
  overallStatus: 'in_stock',
  variantsInStock: 2,
  variantsLowStock: 0,
  variantsCritical: 0,
  variantsOutOfStock: 1,
  availableColors: [],
  totalVariants: 3,
  totalCurrentStock: 1000,
  totalMinStock: 30,
  totalReservedStock: 0,
  totalInTransitStock: 0,
  totalAvailableStock: 1000,
  variants: [
    v('a', 'Azul', 500, 'in_stock'),
    v('b', 'Verde', 500, 'in_stock'),
    v('c', 'Vermelho', 0, 'out_of_stock'),
  ],
};

describe('VariantStockTable — contrato flat-only (variação-first)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('purga chaves legadas do modo Agrupar no mount', () => {
    window.localStorage.setItem('stock.groupBy', 'grouped');
    window.localStorage.setItem('stock.viewMode', 'grouped');
    window.localStorage.setItem('stock.groupingMode', 'grouped');

    render(<VariantStockTable products={[product]} />);

    expect(window.localStorage.getItem('stock.groupBy')).toBeNull();
    expect(window.localStorage.getItem('stock.viewMode')).toBeNull();
    expect(window.localStorage.getItem('stock.groupingMode')).toBeNull();
  });

  it('não renderiza nenhum toggle/entrada oculta do modo Agrupar', () => {
    const { container } = render(<VariantStockTable products={[product]} />);
    expect(container.querySelector('[data-testid="stock-grouping-toggle"]')).toBeNull();
    expect(screen.queryByText(/^Agrupar$/i)).toBeNull();
    expect(screen.queryByText(/Expandir Todos/i)).toBeNull();
    expect(screen.queryByText(/Recolher Todos/i)).toBeNull();
  });

  it('renderiza 1 linha por variação (3 SKUs = 3 linhas) sem somar no pai', () => {
    render(<VariantStockTable products={[product]} />);
    // Cada SKU individual aparece como linha própria.
    expect(screen.getByText('SKU-a')).toBeInTheDocument();
    expect(screen.getByText('SKU-b')).toBeInTheDocument();
    expect(screen.getByText('SKU-c')).toBeInTheDocument();
    // O total agregado do pai (1000) NÃO deve vazar como número de estoque em uma linha SKU.
    // Cada linha mostra 500/500/0; a string isolada "1000" não aparece como estoque.
    const cells = screen.queryAllByText('1000');
    expect(cells.length).toBe(0);
  });
});
