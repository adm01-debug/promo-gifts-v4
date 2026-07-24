/**
 * Tests for ProductRiskDetail — isolated with mocked recharts, hooks, and router.
 * Covers: loading state, error state, demo mode, data mode, KPIs, navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductRiskDetail } from '@/components/inventory/risk/ProductRiskDetail';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock recharts — avoid canvas/DOM complexity
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Area: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Shared state objects for hook mocks (mutated per-test)
const summaryState = {
  data: null as unknown[] | null,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
};
const velocityState = {
  data: null as unknown[] | null,
  error: null as Error | null,
  refetch: vi.fn(),
};
const intelState = {
  data: null as Record<string, unknown> | null,
  error: null as Error | null,
  refetch: vi.fn(),
};

vi.mock('@/hooks/intelligence', () => ({
  useStockDailySummary: () => summaryState,
  useStockVelocity: () => velocityState,
  useProductIntelligenceData: () => intelState,
  aggregateDailySummaryByDate: vi.fn(() => []),
  getActiveFlags: vi.fn(() => []),
}));

// Use vi.hoisted so factory functions are available when vi.mock runs
const {
  mockGenerateMockVelocity,
  mockGenerateMockIntelligence,
  mockSafePriceChanges,
  mockIsRealIntelligence,
} = vi.hoisted(() => ({
  mockGenerateMockVelocity: vi.fn(() => ({
    avg_daily_depletion_7d: 3.5,
    days_to_stockout: 28,
    velocity_trend: 1.1,
    current_stock: 100,
  })),
  mockGenerateMockIntelligence: vi.fn(() => ({
    is_hot_product: false,
    is_stockout_risk: false,
    is_stagnant: false,
    is_negotiation_opportunity: false,
    has_frequent_restock: false,
    abc_classification: 'B',
    total_current_stock: 100,
    supplier_count: 1,
  })),
  mockSafePriceChanges: vi.fn(() => 0),
  mockIsRealIntelligence: vi.fn(() => false),
}));

vi.mock('@/lib/stock-chart-utils', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();
  return {
    ...actual,
    generateMockStockData: vi.fn(() => []),
    generateMockVelocity: mockGenerateMockVelocity,
    generateMockIntelligence: mockGenerateMockIntelligence,
    safePriceChanges: mockSafePriceChanges,
    isRealIntelligence: mockIsRealIntelligence,
    safeParseDateForChart: vi.fn((date: string) => ({
      dateFormatted: date.substring(5, 10),
      fullDate: date,
    })),
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
  summaryState.data = null;
  summaryState.isLoading = false;
  summaryState.error = null;
  summaryState.refetch = vi.fn();
  velocityState.data = null;
  velocityState.error = null;
  velocityState.refetch = vi.fn();
  intelState.data = null;
  intelState.error = null;
  intelState.refetch = vi.fn();
  mockGenerateMockVelocity.mockReturnValue({
    avg_daily_depletion_7d: 3.5,
    days_to_stockout: 28,
    velocity_trend: 1.1,
    current_stock: 100,
  });
  mockGenerateMockIntelligence.mockReturnValue({
    is_hot_product: false,
    is_stockout_risk: false,
    is_stagnant: false,
    is_negotiation_opportunity: false,
    has_frequent_restock: false,
    abc_classification: 'B',
    total_current_stock: 100,
    supplier_count: 1,
  });
  mockSafePriceChanges.mockReturnValue(0);
  mockIsRealIntelligence.mockReturnValue(false);
});

describe('ProductRiskDetail — loading state', () => {
  it('renders loading spinner when isLoading=true', () => {
    summaryState.isLoading = true;
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByRole('status', { name: /Carregando/i })).toBeInTheDocument();
  });
});

describe('ProductRiskDetail — error state', () => {
  it('renders error message when summary has error and no data', () => {
    summaryState.error = new Error('fetch failed');
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByText(/Erro ao carregar dados/i)).toBeInTheDocument();
  });

  it('retry button calls all three refetch functions', () => {
    const refetchSummary = vi.fn();
    const refetchVelocity = vi.fn();
    const refetchIntel = vi.fn();
    summaryState.error = new Error('fail');
    summaryState.refetch = refetchSummary;
    velocityState.refetch = refetchVelocity;
    intelState.refetch = refetchIntel;
    render(<ProductRiskDetail productId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(refetchSummary).toHaveBeenCalled();
    expect(refetchVelocity).toHaveBeenCalled();
    expect(refetchIntel).toHaveBeenCalled();
  });
});

describe('ProductRiskDetail — demo mode', () => {
  it('renders product name when provided', () => {
    render(<ProductRiskDetail productId="p1" productName="Caneta Azul" />);
    expect(screen.getByText('Caneta Azul')).toBeInTheDocument();
  });

  it('renders productId as fallback when name not provided', () => {
    render(<ProductRiskDetail productId="p123" />);
    expect(screen.getByText('p123')).toBeInTheDocument();
  });

  it('renders "demo" badge in demo mode', () => {
    render(<ProductRiskDetail productId="p1" productName="Test" />);
    expect(screen.getByText('demo')).toBeInTheDocument();
  });

  it('renders period tab buttons 15d through 180d', () => {
    render(<ProductRiskDetail productId="p1" />);
    for (const p of ['15d', '30d', '60d', '90d', '120d', '180d']) {
      expect(screen.getByRole('tab', { name: p })).toBeInTheDocument();
    }
  });

  it('renders KPI metrics group', () => {
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByRole('group', { name: /Métricas de risco/i })).toBeInTheDocument();
  });

  it('renders chart container', () => {
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('expand/collapse chart toggle button works', () => {
    render(<ProductRiskDetail productId="p1" />);
    const expandBtn = screen.getByRole('button', { name: /Expandir gráfico/i });
    fireEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /Minimizar gráfico/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Minimizar gráfico/i }));
    expect(screen.getByRole('button', { name: /Expandir gráfico/i })).toBeInTheDocument();
  });

  it('"Ver produto" button navigates to product page', () => {
    render(<ProductRiskDetail productId="prod-42" />);
    fireEvent.click(screen.getByRole('button', { name: /Ver produto/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/produto/prod-42');
  });

  it('clicking period tab does not throw', () => {
    render(<ProductRiskDetail productId="p1" />);
    const tab60 = screen.getByRole('tab', { name: '60d' });
    // Simply verifying click does not crash
    expect(() => fireEvent.click(tab60)).not.toThrow();
  });

  it('shows days-to-stockout 28 from mock velocity', () => {
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('shows ∞ when days_to_stockout is Infinity', () => {
    mockGenerateMockVelocity.mockReturnValueOnce({
      avg_daily_depletion_7d: 0,
      days_to_stockout: Infinity,
      velocity_trend: 1.0,
      current_stock: 100,
    });
    render(<ProductRiskDetail productId="p2" />);
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('shows URGENTE when daysToStockout < 7', () => {
    mockGenerateMockVelocity.mockReturnValueOnce({
      avg_daily_depletion_7d: 10,
      days_to_stockout: 3,
      velocity_trend: 1.5,
      current_stock: 30,
    });
    render(<ProductRiskDetail productId="p3" />);
    expect(screen.getByText('URGENTE!')).toBeInTheDocument();
  });

  it('shows "atenção" when daysToStockout >= 7 and < 15', () => {
    mockGenerateMockVelocity.mockReturnValueOnce({
      avg_daily_depletion_7d: 5,
      days_to_stockout: 10,
      velocity_trend: 1.2,
      current_stock: 50,
    });
    render(<ProductRiskDetail productId="p4" />);
    expect(screen.getByText('atenção')).toBeInTheDocument();
  });
});

describe('ProductRiskDetail — ABC classification badge', () => {
  it('shows "Classe B" badge from mock intelligence', () => {
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByText('Classe B')).toBeInTheDocument();
  });

  it('shows "Classe A" badge when abc_classification=A', () => {
    mockGenerateMockIntelligence.mockReturnValue({
      is_hot_product: false,
      is_stockout_risk: false,
      is_stagnant: false,
      is_negotiation_opportunity: false,
      has_frequent_restock: false,
      abc_classification: 'A',
      total_current_stock: 50,
      supplier_count: 2,
    });
    render(<ProductRiskDetail productId="p5" />);
    // "Classe A" may appear in ABC badge and/or class-a flag label
    expect(screen.getAllByText('Classe A').length).toBeGreaterThan(0);
  });
});

describe('ProductRiskDetail — price changes', () => {
  it('does NOT show price change info when priceChanges=0', () => {
    mockSafePriceChanges.mockReturnValue(0);
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.queryByText(/alteração.*preço/i)).not.toBeInTheDocument();
  });

  it('shows price change info when priceChanges=1', () => {
    mockSafePriceChanges.mockReturnValue(1);
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByText(/1 alteração de preço/)).toBeInTheDocument();
  });

  it('shows plural price change text when priceChanges=3', () => {
    mockSafePriceChanges.mockReturnValue(3);
    render(<ProductRiskDetail productId="p1" />);
    expect(screen.getByText(/3 alterações de preço/)).toBeInTheDocument();
  });
});
