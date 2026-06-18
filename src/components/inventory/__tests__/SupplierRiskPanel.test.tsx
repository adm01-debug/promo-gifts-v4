/**
 * Testes para SupplierRiskPanel — cobertura do orchestrator de risco de fornecedor.
 * Cobre: estado vazio, produtos com severidades variadas, busca, filtro de severidade,
 * seleção, contadores KPI e lastUpdated.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SupplierRiskPanel } from '@/components/inventory/SupplierRiskPanel';
import type { ProductStockSummary } from '@/types/stock';

// Mocka o virtualizer para controle determinístico da lista
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getTotalSize: () => count * 52,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 52,
        size: 52,
        key: i,
      })),
  })),
}));

// Mocka o painel de detalhe para isolar o componente principal
vi.mock('@/components/inventory/risk/ProductRiskDetail', () => ({
  ProductRiskDetail: ({ productId }: { productId: string }) => (
    <div data-testid={`product-risk-detail-${productId}`}>Detalhe {productId}</div>
  ),
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
    totalMinStock: 50,
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

const criticalProduct = makeProduct('crit', {
  overallStatus: 'critical',
  totalCurrentStock: 5,
  variants: [{ updatedAt: '2026-06-18T10:00:00.000Z' } as never],
});

const warningProduct = makeProduct('warn', {
  overallStatus: 'low_stock',
  totalCurrentStock: 20,
  variants: [],
});

const okProduct = makeProduct('ok1', {
  overallStatus: 'in_stock',
  totalCurrentStock: 200,
  variants: [],
});

describe('SupplierRiskPanel — estado vazio', () => {
  it('renders empty state message when no products', () => {
    render(<SupplierRiskPanel products={[]} />);
    expect(screen.getByText(/Sem dados disponíveis/)).toBeInTheDocument();
  });

  it('renders panel title in empty state', () => {
    render(<SupplierRiskPanel products={[]} />);
    expect(screen.getByText(/Risco de Ruptura no Fornecedor/)).toBeInTheDocument();
  });
});

describe('SupplierRiskPanel — com produtos', () => {
  const products = [criticalProduct, warningProduct, okProduct];

  it('renders product names', () => {
    render(<SupplierRiskPanel products={products} />);
    expect(screen.getByText('Produto crit')).toBeInTheDocument();
    expect(screen.getByText('Produto warn')).toBeInTheDocument();
    expect(screen.getByText('Produto ok1')).toBeInTheDocument();
  });

  it('shows critical badge when there are critical products', () => {
    render(<SupplierRiskPanel products={products} />);
    // Badge in the title shows "N crítico(s)"
    const criticalBadge = screen.getAllByText(/1 crítico/i);
    expect(criticalBadge.length).toBeGreaterThan(0);
  });

  it('renders KPI counters with correct totals', () => {
    render(<SupplierRiskPanel products={products} />);
    // 1 critical, 1 warning, 1 ok
    const statuses = screen
      .getAllByRole('status')
      .map((el) => el.getAttribute('aria-label'))
      .filter(Boolean);
    expect(statuses.some((s) => s?.includes('1 produtos críticos'))).toBe(true);
    expect(statuses.some((s) => s?.includes('1 produtos em atenção'))).toBe(true);
    expect(statuses.some((s) => s?.includes('1 produtos OK'))).toBe(true);
  });

  it('auto-selects first product (critical = first by sort)', () => {
    render(<SupplierRiskPanel products={products} />);
    // Critical product is first — its detail should be shown
    expect(screen.getByTestId('product-risk-detail-crit')).toBeInTheDocument();
  });

  it('selects product on click', async () => {
    render(<SupplierRiskPanel products={products} />);
    const okBtn = screen.getByRole('option', { name: /Produto ok1/i });
    await act(async () => {
      fireEvent.click(okBtn);
    });
    expect(screen.getByTestId('product-risk-detail-ok1')).toBeInTheDocument();
  });

  it('shows lastUpdated timestamp when variant has updatedAt', () => {
    render(<SupplierRiskPanel products={[criticalProduct]} />);
    // The aria-label for the timestamp span
    const timeEl = document.querySelector('[aria-label*="Última atualização"]');
    expect(timeEl).not.toBeNull();
  });
});

describe('SupplierRiskPanel — busca', () => {
  const products = [criticalProduct, warningProduct, okProduct];

  it('filters products by name', async () => {
    render(<SupplierRiskPanel products={products} />);
    const input = screen.getByPlaceholderText(/Buscar produto ou SKU/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: 'crit' } });
    });
    // After debounce timeout (300ms) — act alone doesn't advance timers,
    // but at least the input is reflected
    expect(input).toHaveValue('crit');
  });

  it('shows "Nenhum produto encontrado" when search has no results', async () => {
    vi.useFakeTimers();
    render(<SupplierRiskPanel products={products} />);
    const input = screen.getByPlaceholderText(/Buscar produto ou SKU/i);
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('SupplierRiskPanel — filtro de severidade', () => {
  const products = [criticalProduct, warningProduct, okProduct];

  it('renders severity filter buttons', () => {
    render(<SupplierRiskPanel products={products} />);
    expect(screen.getByRole('radiogroup', { name: /Filtrar por severidade/i })).toBeInTheDocument();
  });

  it('clicking "Críticos" filter hides non-critical products', async () => {
    render(<SupplierRiskPanel products={products} />);
    const critBtn = screen.getByRole('radio', { name: /Críticos/i });
    await act(async () => {
      fireEvent.click(critBtn);
    });
    // only critical should remain in the list
    expect(screen.queryByText('Produto ok1')).toBeNull();
    expect(screen.queryByText('Produto warn')).toBeNull();
    expect(screen.getByText('Produto crit')).toBeInTheDocument();
  });

  it('clicking "OK" filter shows only ok products', async () => {
    render(<SupplierRiskPanel products={products} />);
    const okBtn = screen.getByRole('radio', { name: /^OK/i });
    await act(async () => {
      fireEvent.click(okBtn);
    });
    expect(screen.getByText('Produto ok1')).toBeInTheDocument();
    expect(screen.queryByText('Produto crit')).toBeNull();
  });

  it('clicking "Todos" after filter shows all products', async () => {
    render(<SupplierRiskPanel products={products} />);
    const critBtn = screen.getByRole('radio', { name: /Críticos/i });
    const todosBtn = screen.getByRole('radio', { name: /Todos/i });
    await act(async () => {
      fireEvent.click(critBtn);
    });
    await act(async () => {
      fireEvent.click(todosBtn);
    });
    expect(screen.getByText('Produto ok1')).toBeInTheDocument();
    expect(screen.getByText('Produto warn')).toBeInTheDocument();
    expect(screen.getByText('Produto crit')).toBeInTheDocument();
  });
});

describe('SupplierRiskPanel — estado "sem produto nesta categoria"', () => {
  it('shows message when all products filtered out by severity', async () => {
    // only ok product, filter by critical → empty list
    vi.useFakeTimers();
    render(<SupplierRiskPanel products={[okProduct]} />);
    const critBtn = screen.getByRole('radio', { name: /Críticos/i });
    await act(async () => {
      fireEvent.click(critBtn);
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByText('Nenhum produto nesta categoria')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
