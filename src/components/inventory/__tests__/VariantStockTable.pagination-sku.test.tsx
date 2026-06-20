/**
 * Contrato de SCROLL VIRTUAL SKU-first do módulo Estoque:
 *  - A unidade de scroll é o SKU (variação), não o produto-pai.
 *  - 1 produto com 60 variações → contador exibe "60 variações" (sem intervalo de página).
 *  - O scroll virtual substitui a paginação: não há botões Anterior/Próximo.
 *  - Todas as 60 variações estão disponíveis para renderização (não cortadas em páginas).
 *
 * Guarda de regressão: contra reintrodução de paginação por produto-pai
 * (no modelo antigo, paginação por produto impedia o split de variações entre "páginas").
 *
 * Nota técnica: useVirtualizer é mockado neste arquivo para renderizar todos os itens,
 * pois em jsdom o container tem height=0 e o virtualizer real não renderia nenhum item.
 * Os testes de virtualização real ficam em stock-filter.perf.test.ts (sem DOM).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariantStockTable } from '@/components/inventory/VariantStockTable';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

// Renderiza todos os itens para que o DOM reflita o estado completo do filtro.
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

describe('VariantStockTable — scroll virtual SKU-first', () => {
  beforeEach(() => window.localStorage.clear());

  it('contador exibe total de variações sem intervalo de página', () => {
    render(<VariantStockTable products={[product]} />);
    expect(screen.getByText('60 variações')).toBeInTheDocument();
    expect(screen.queryByText(/1[–-]50 de/)).not.toBeInTheDocument();
  });

  it('não renderiza controles de paginação (Anterior / Próximo)', () => {
    render(<VariantStockTable products={[product]} />);
    expect(screen.queryByText('Anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Próximo')).not.toBeInTheDocument();
  });

  it('todas as 60 variações ficam acessíveis — SKU-0 e SKU-59 presentes no DOM', () => {
    render(<VariantStockTable products={[product]} />);
    // Com scroll virtual, NÃO há corte em 50 linhas — todas as 60 são acessíveis:
    expect(screen.getByText('SKU-0')).toBeInTheDocument();
    expect(screen.getByText('SKU-59')).toBeInTheDocument();
    // Garante exatamente 60 SKU cells (sem duplicatas do virtualizer mock):
    const skuCells = screen.getAllByText(/^SKU-\d+$/);
    expect(skuCells).toHaveLength(60);
  });

  it('container de scroll virtual tem data-testid correto', () => {
    render(<VariantStockTable products={[product]} />);
    expect(document.querySelector('[data-testid="variant-stock-scroll"]')).toBeInTheDocument();
  });
});
