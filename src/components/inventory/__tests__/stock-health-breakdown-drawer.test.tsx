/**
 * Tests for StockHealthBreakdownDrawer — Sheet with tabs, search, and product rows.
 * Covers: render, tab switching, search filtering, empty states.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StockHealthBreakdownDrawer } from '@/components/inventory/StockHealthBreakdownDrawer';
import type { ProductStockSummary } from '@/types/stock';

vi.mock('@/lib/inventory/health-score', () => ({
  bucketByStatus: vi.fn((products: ProductStockSummary[]) => {
    return {
      healthy: products.filter((p) => p.overallStatus === 'in_stock'),
      low: products.filter((p) => p.overallStatus === 'low_stock'),
      critical: products.filter((p) => p.overallStatus === 'critical'),
      out: products.filter((p) => p.overallStatus === 'out_of_stock'),
    };
  }),
}));

vi.mock('@/components/inventory/StockThresholdsLegend', () => ({
  StockThresholdsLegend: () => <div data-testid="thresholds-legend" />,
}));

function makeProduct(
  id: string,
  overrides: Partial<ProductStockSummary> = {},
): ProductStockSummary {
  return {
    productId: id,
    productName: `Produto ${id}`,
    productSku: `SKU-${id}`,
    totalCurrentStock: 100,
    totalMinStock: 20,
    totalReservedStock: 0,
    totalInTransitStock: 0,
    totalAvailableStock: 100,
    overallStatus: 'in_stock',
    variantsInStock: 1,
    variantsLowStock: 0,
    variantsCritical: 0,
    variantsOutOfStock: 0,
    totalVariants: 1,
    variants: [],
    availableColors: [],
    ...overrides,
  };
}

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('StockHealthBreakdownDrawer — render', () => {
  const products = [
    makeProduct('h1', { overallStatus: 'in_stock' }),
    makeProduct('l1', { overallStatus: 'low_stock' }),
    makeProduct('c1', { overallStatus: 'critical' }),
    makeProduct('o1', { overallStatus: 'out_of_stock' }),
  ];

  it('renders drawer title', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByText('Produtos por faixa de estoque')).toBeInTheDocument();
  });

  it('shows product count in description', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByText(/4 produtos/)).toBeInTheDocument();
  });

  it('renders all 4 tab triggers', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByTestId('tab-healthy')).toBeInTheDocument();
    expect(screen.getByTestId('tab-low')).toBeInTheDocument();
    expect(screen.getByTestId('tab-critical')).toBeInTheDocument();
    expect(screen.getByTestId('tab-out')).toBeInTheDocument();
  });

  it('renders thresholds legend', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByTestId('thresholds-legend')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByTestId('stock-breakdown-search')).toBeInTheDocument();
  });

  it('initially shows healthy products (default tab)', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    // "Produto h1" is healthy, should be visible in the list
    const rows = screen.getAllByTestId('stock-breakdown-row');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('StockHealthBreakdownDrawer — search filter', () => {
  const products = [
    makeProduct('abc', { overallStatus: 'in_stock', productName: 'Produto ABC' }),
    makeProduct('xyz', { overallStatus: 'in_stock', productName: 'Produto XYZ' }),
  ];

  it('filters to matching product by name', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    const input = screen.getByTestId('stock-breakdown-search');
    fireEvent.change(input, { target: { value: 'ABC' } });
    expect(screen.queryByText('Produto XYZ')).not.toBeInTheDocument();
    expect(screen.getByText('Produto ABC')).toBeInTheDocument();
  });

  it('shows empty state when no product matches search', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    const input = screen.getByTestId('stock-breakdown-search');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('stock-breakdown-empty')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum produto corresponde à busca/)).toBeInTheDocument();
  });

  it('shows "nenhum produto nesta faixa" when bucket is empty', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={[]} />
      </Wrapper>,
    );
    // healthy bucket will be empty
    expect(screen.getByTestId('stock-breakdown-empty')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum produto nesta faixa/)).toBeInTheDocument();
  });
});

describe('StockHealthBreakdownDrawer — closed state', () => {
  it('does not render content when closed', () => {
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open={false} onOpenChange={vi.fn()} products={[]} />
      </Wrapper>,
    );
    expect(screen.queryByText('Produtos por faixa de estoque')).not.toBeInTheDocument();
  });
});

describe('StockHealthBreakdownDrawer — ProductRow', () => {
  it('renders product name and SKU', () => {
    const products = [
      makeProduct('p1', {
        overallStatus: 'in_stock',
        productName: 'Bola de Futebol',
        productSku: 'BF-001',
      }),
    ];
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    expect(screen.getByText('Bola de Futebol')).toBeInTheDocument();
    expect(screen.getByText('SKU BF-001')).toBeInTheDocument();
  });

  it('renders stock and min stock values', () => {
    const products = [
      makeProduct('p1', {
        overallStatus: 'in_stock',
        totalCurrentStock: 250,
        totalMinStock: 50,
      }),
    ];
    render(
      <Wrapper>
        <StockHealthBreakdownDrawer open onOpenChange={vi.fn()} products={products} />
      </Wrapper>,
    );
    // Stock values formatted with pt-BR locale
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText(/mín 50/)).toBeInTheDocument();
  });
});
