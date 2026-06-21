import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import {
  defaultStockFilters,
  type ProductStockSummary,
  type StockDashboardSummary,
  type StockAlert,
  type FutureStockEntry,
  type VariantStock,
  type StockFilters,
} from '@/types/stock';

// ── Mock useVariantStock (the single data source for the dashboard) ──
const mockUseVariantStock = vi.fn();
vi.mock('@/hooks/products', () => ({
  useVariantStock: () => mockUseVariantStock(),
  noveltyToProduct: vi.fn(),
}));

// ── Mock toast ──────────────────────────────────────────────────
const toast = vi.fn();
vi.mock('@/hooks/ui', () => ({
  useToast: () => ({ toast }),
}));

// ── Stub the lazy heavy panels (their own trees are tested elsewhere). ──
vi.mock('../SupplierRiskPanel', () => ({
  SupplierRiskPanel: ({ products }: { products: ProductStockSummary[] }) => (
    <div data-testid="supplier-risk-panel">risk-panel:{products.length}</div>
  ),
}));
vi.mock('../StockHealthBreakdownDrawer', () => ({
  StockHealthBreakdownDrawer: ({
    open,
    products,
  }: {
    open: boolean;
    products: ProductStockSummary[];
  }) => (open ? <div data-testid="health-drawer">health-drawer:{products.length}</div> : null),
}));

// VariantStockTable is heavy; stub to keep the dashboard focused.
vi.mock('../VariantStockTable', () => ({
  VariantStockTable: ({ products }: { products: ProductStockSummary[] }) => (
    <div data-testid="variant-stock-table">table:{products.length}</div>
  ),
}));

import { StockDashboard } from '../StockDashboard';

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture = vi.fn(() => false);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.scrollIntoView = vi.fn();
});

// ── Factories ───────────────────────────────────────────────────
let seq = 0;
const variant = (over: Partial<VariantStock> = {}): VariantStock => {
  seq += 1;
  return {
    id: `v-${seq}`,
    productId: `p-${seq}`,
    variantId: `vid-${seq}`,
    variantSku: `VSKU-${seq}`,
    currentStock: 10,
    minStock: 5,
    reservedStock: 0,
    inTransitStock: 0,
    availableStock: 10,
    status: 'in_stock',
    colorName: 'Azul',
    updatedAt: '2026-06-15T10:00:00.000Z',
    ...over,
  };
};

const product = (over: Partial<ProductStockSummary> = {}): ProductStockSummary => {
  seq += 1;
  return {
    productId: over.productId ?? `prod-${seq}`,
    productName: over.productName ?? `Produto ${seq}`,
    productSku: over.productSku ?? `SKU-${seq}`,
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
    variants: [variant()],
    availableColors: [],
    ...over,
  };
};

const alert = (over: Partial<StockAlert> = {}): StockAlert => {
  seq += 1;
  return {
    id: over.id ?? `a-${seq}`,
    type: over.type ?? 'out_of_stock',
    severity: over.severity ?? 'error',
    productId: over.productId ?? `prod-${seq}`,
    productName: over.productName ?? `Produto ${seq}`,
    productSku: over.productSku ?? `SKU-${seq}`,
    title: over.title ?? 'Alerta',
    message: over.message ?? 'Mensagem',
    currentStock: over.currentStock ?? 0,
    threshold: over.threshold ?? 10,
    createdAt: over.createdAt ?? '2026-06-15T10:00:00.000Z',
    ...over,
  };
};

const futureEntry = (over: Partial<FutureStockEntry> = {}): FutureStockEntry => {
  seq += 1;
  return {
    id: over.id ?? `f-${seq}`,
    productId: over.productId ?? `prod-${seq}`,
    productName: over.productName ?? `Futuro ${seq}`,
    expectedQuantity: over.expectedQuantity ?? 50,
    expectedDate: over.expectedDate ?? '2026-07-01T00:00:00.000Z',
    source: over.source ?? 'purchase_order',
    status: over.status ?? 'confirmed',
    createdAt: over.createdAt ?? '2026-06-10T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2026-06-12T00:00:00.000Z',
    ...over,
  };
};

const summaryOf = (over: Partial<StockDashboardSummary> = {}): StockDashboardSummary => ({
  totalProducts: 10,
  totalVariants: 25,
  totalColors: 4,
  productsInStock: 7,
  productsLowStock: 2,
  productsCritical: 1,
  productsOutOfStock: 1,
  variantsInStock: 18,
  variantsLowStock: 4,
  variantsCritical: 2,
  variantsOutOfStock: 1,
  totalStockValue: 0,
  totalAvailableValue: 0,
  averageDaysOfStock: 0,
  stockTurnoverRate: 0,
  totalAlerts: 5,
  criticalAlerts: 1,
  incomingStockValue: 0,
  ...over,
});

// Default vi.fn handlers — re-created per test for assertion clarity.
let updateFilter: ReturnType<typeof vi.fn>;
let resetFilters: ReturnType<typeof vi.fn>;
let fetchStockData: ReturnType<typeof vi.fn>;
let dismissAlert: ReturnType<typeof vi.fn>;
let dismissAlertsBySeverity: ReturnType<typeof vi.fn>;

const buildHookValue = (over: Record<string, unknown> = {}) => {
  const products = (over.allProductStocks as ProductStockSummary[]) ?? [product()];
  return {
    isLoading: false,
    isFetching: false,
    loadingProgress: { step: '', current: 3, total: 3 },
    productStocks: (over.productStocks as ProductStockSummary[]) ?? products,
    allProductStocks: products,
    summary: (over.summary as StockDashboardSummary) ?? summaryOf(),
    alerts: (over.alerts as StockAlert[]) ?? [],
    criticalAlerts: (over.criticalAlerts as StockAlert[]) ?? [],
    filters: (over.filters as StockFilters) ?? { ...defaultStockFilters },
    futureStock: (over.futureStock as FutureStockEntry[]) ?? [],
    allColors: ['Azul', 'Vermelho'],
    availableCategories: [{ name: 'Canetas', count: 5 }],
    availableSuppliers: [{ name: 'XBZ', count: 5 }],
    availableColorGroups: [{ name: 'Azul', count: 3 }],
    error: (over.error as unknown) ?? null,
    fetchStockData,
    updateFilter,
    resetFilters,
    dismissAlert,
    dismissAlertsBySeverity,
    ...over,
  };
};

const renderDashboard = () =>
  render(
    <BrowserRouter>
      <StockDashboard />
    </BrowserRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  updateFilter = vi.fn();
  resetFilters = vi.fn();
  fetchStockData = vi.fn();
  dismissAlert = vi.fn();
  dismissAlertsBySeverity = vi.fn();
  localStorage.clear();
  mockUseVariantStock.mockReturnValue(buildHookValue());
});

describe('StockDashboard — render states', () => {
  it('mostra o estado de carregamento (skeletons + progresso)', () => {
    mockUseVariantStock.mockReturnValue(
      buildHookValue({
        isLoading: true,
        loadingProgress: { step: 'Conectando...', current: 1, total: 3 },
      }),
    );
    renderDashboard();
    expect(screen.getByText('Sincronizando estoque')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('mostra estado de erro com botão "Tentar novamente"', async () => {
    const user = userEvent.setup();
    mockUseVariantStock.mockReturnValue(buildHookValue({ error: new Error('Falha de rede') }));
    renderDashboard();
    expect(screen.getByText('Falha ao carregar estoque')).toBeInTheDocument();
    expect(screen.getByText('Falha de rede')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(fetchStockData).toHaveBeenCalled();
  });

  it('renderiza cartões de KPI e tabela quando carregado', () => {
    renderDashboard();
    // StatCards expose unique aria-labels ("<title>: <value>. <hint>").
    expect(screen.getByRole('button', { name: /^Total de Produtos:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Em Estoque:/ })).toBeInTheDocument();
    // "Crítico" replaced the defunct "Estoque Baixo" card (kpi-consistency.test.tsx).
    expect(screen.getByRole('button', { name: /^Crítico:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sem Estoque:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Estoque Futuro:/ })).toBeInTheDocument();
    expect(screen.getByTestId('variant-stock-table')).toBeInTheDocument();
  });

  it('exibe o card "Estoque por Cor/Variação" com contagem de produtos', () => {
    renderDashboard();
    // CardTitle da seção de tabela — confirma que o dashboard está carregado
    expect(screen.getByText('Estoque por Cor/Variação')).toBeInTheDocument();
    // health-score-badge foi removido intencionalmente (regression test confirma)
    expect(screen.queryByTestId('health-score-badge')).not.toBeInTheDocument();
  });
});

describe('StockDashboard — stat card filters', () => {
  it('clica em "Total de Produtos" e aplica status=all', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /^Total de Produtos:/ }));
    expect(updateFilter).toHaveBeenCalledWith('status', 'all');
  });

  it('clica em "Em Estoque" e alterna o filtro in_stock', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /^Em Estoque:/ }));
    expect(updateFilter).toHaveBeenCalledWith('status', 'in_stock');
  });

  it('clica em "Sem Estoque" — alterna filtro e abre dialog quando há críticos', async () => {
    const user = userEvent.setup();
    mockUseVariantStock.mockReturnValue(
      buildHookValue({ criticalAlerts: [alert({ severity: 'error' })] }),
    );
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /^Sem Estoque:/ }));
    expect(updateFilter).toHaveBeenCalledWith('status', 'out_of_stock');
  });

  it('clica em "Estoque Futuro" — alterna filtro e abre dialog quando há previsões', async () => {
    const user = userEvent.setup();
    mockUseVariantStock.mockReturnValue(
      buildHookValue({ futureStock: [futureEntry({ productName: 'Reposição X' })] }),
    );
    renderDashboard();
    await user.click(screen.getByRole('button', { name: /^Estoque Futuro:/ }));
    expect(updateFilter).toHaveBeenCalledWith('status', 'incoming');
    // dialog opens with the future entries
    await waitFor(() => expect(screen.getByText('Previsão de Reposição')).toBeInTheDocument());
  });
});

describe('StockDashboard — critical alerts & active filter', () => {
  it('clica em "Sem Estoque" com alertas críticos → abre o OutOfStockDialog', async () => {
    const user = userEvent.setup();
    mockUseVariantStock.mockReturnValue(
      buildHookValue({
        criticalAlerts: [alert({ severity: 'error', productName: 'Crítico A' })],
      }),
    );
    renderDashboard();
    // critical-alerts-badge foi removido intencionalmente; o dialog ainda abre
    // via clique no StatCard "Sem Estoque" quando há alertas críticos.
    expect(screen.queryByTestId('critical-alerts-badge')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Sem Estoque:/ }));
    expect(updateFilter).toHaveBeenCalledWith('status', 'out_of_stock');
    await waitFor(() => expect(screen.getByText('Crítico A')).toBeInTheDocument());
  });

  it('mostra o chip de filtro ativo e remove o filtro ao clicar no X', async () => {
    const user = userEvent.setup();
    mockUseVariantStock.mockReturnValue(
      buildHookValue({ filters: { ...defaultStockFilters, status: 'low_stock' } }),
    );
    renderDashboard();
    expect(screen.getByText('Filtro ativo:')).toBeInTheDocument();
    // The active-filter chip contains the label next to the "Remover filtro" button.
    const removeBtn = screen.getByRole('button', { name: 'Remover filtro' });
    expect(removeBtn.closest('span')).toHaveTextContent('Estoque Baixo');
    await user.click(removeBtn);
    expect(updateFilter).toHaveBeenCalledWith('status', 'all');
  });
});

describe('StockDashboard — health drawer & risk panel', () => {
  it('health drawer começa fechado (sem trigger visível no header)', () => {
    renderDashboard();
    // health-score-badge foi removido; o drawer não é renderizado por padrão.
    expect(screen.queryByTestId('health-score-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('health-drawer')).not.toBeInTheDocument();
  });

  it('exibe o painel de risco por padrão e permite recolher', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('supplier-risk-panel')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Painel de Risco do Fornecedor/ }));
    expect(screen.queryByTestId('supplier-risk-panel')).not.toBeInTheDocument();
    // preference persisted
    expect(localStorage.getItem('stock-dashboard:risk-panel-open:v1')).toBe('0');
  });

  it('respeita a preferência salva (painel recolhido) no localStorage', () => {
    localStorage.setItem('stock-dashboard:risk-panel-open:v1', '0');
    renderDashboard();
    expect(screen.queryByTestId('supplier-risk-panel')).not.toBeInTheDocument();
  });
});

describe('StockDashboard — info alerts', () => {
  it('renderiza alertas informativos e botão limpar todos', async () => {
    const user = userEvent.setup();
    const infos = [
      alert({ id: 'i1', severity: 'info', title: 'Info 1', productName: 'P1' }),
      alert({ id: 'i2', severity: 'info', title: 'Info 2', productName: 'P2' }),
    ];
    mockUseVariantStock.mockReturnValue(buildHookValue({ alerts: infos }));
    renderDashboard();
    expect(screen.getByText('Outros Alertas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Limpar Todos/ }));
    expect(dismissAlertsBySeverity).toHaveBeenCalledWith('info');
  });
});

describe('StockDashboard — keyboard shortcut', () => {
  it('Ctrl+Shift+S dispara refresh e toast', async () => {
    renderDashboard();
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'S', ctrlKey: true, shiftKey: true }),
      );
    });
    expect(fetchStockData).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Atalho: Ctrl+Shift+S' }),
    );
  });
});
