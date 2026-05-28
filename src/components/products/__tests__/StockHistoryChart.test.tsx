import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockHistoryChart } from '../StockHistoryChart';
import { useStockChartData } from '../useStockChartData';

vi.mock('../useStockChartData', () => ({
  useStockChartData: vi.fn(),
}));

// Mock Recharts to avoid issues in test environment
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  Area: () => <div />,
  Bar: () => <div />,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange, value }: any) => (
    <div data-testid="tabs" data-value={value} onClick={(e: any) => {
      const val = e.target.getAttribute('data-value');
      if (val) onValueChange(val);
    }}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: any) => (
    <button data-value={value}>{children}</button>
  ),
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));


describe('StockHistoryChart', () => {
  const mockProductId = 'prod_123';

  const defaultMockData = {
    period: '30',
    setPeriod: vi.fn(),
    showCost: false,
    setShowCost: vi.fn(),
    selectedSupplier: 'all',
    setSelectedSupplier: vi.fn(),
    days: 30,
    loadingSummary: false,
    hasData: true,
    hasError: false,
    isDemo: false,
    chartData: [],
    effectiveIntelligence: { abc_classification: 'A', turnover_score: 95, total_current_stock: 1000 },
    effectiveVelocities: [{ supplier_id: 'S1', avg_daily_depletion_7d: 12 }],
    bestVelocity: { avg_daily_depletion_7d: 12, velocity_trend: 1.2 },
    flags: ['hot-product'],
    supplierOptions: [],
    supplierNamesMap: new Map(),
    trend: 1.2,
    trendDisplay: { value: '+20%', sub: 'em ascensão' },
    marketDemandLevel: 'high',
    demandLabel: { 
      high: { text: 'Alta', color: 'text-warning' },
      'very-high': { text: 'Muito Alta', color: 'text-destructive' },
      moderate: { text: 'Moderada', color: 'text-primary' },
      low: { text: 'Baixa', color: 'text-muted-foreground' },
      unknown: { text: '—', color: 'text-muted-foreground' },
    },
    supplierText: 'em 1 fornecedor',
    priceChanges: 0,
    turnoverScore: 95,
    showTurnover: true,
    handleRetry: vi.fn(),
  };

  it('should render loading state', () => {
    (useStockChartData as any).mockReturnValue({
      ...defaultMockData,
      loadingSummary: true,
    });

    render(<StockHistoryChart productId={mockProductId} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render error state with retry button', () => {
    (useStockChartData as any).mockReturnValue({
      ...defaultMockData,
      hasError: true,
      hasData: false,
    });

    render(<StockHistoryChart productId={mockProductId} />);
    expect(screen.getByText(/Não foi possível carregar dados de mercado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it('should render main KPI cards', () => {
    (useStockChartData as any).mockReturnValue(defaultMockData);

    render(<StockHistoryChart productId={mockProductId} />);
    
    expect(screen.getByText('Vendas no mercado')).toBeInTheDocument();
    expect(screen.getByText('12.0')).toBeInTheDocument(); // avg_daily_depletion_7d
    expect(screen.getByText('Alta')).toBeInTheDocument(); // demandLabel.high.text
    expect(screen.getByText('+20%')).toBeInTheDocument(); // trendDisplay.value
    expect(screen.getByText('1.000')).toBeInTheDocument(); // total_current_stock
  });

  it('should render active market flags', () => {
    (useStockChartData as any).mockReturnValue(defaultMockData);

    render(<StockHistoryChart productId={mockProductId} />);
    
    expect(screen.getByText('Sucesso no Mercado')).toBeInTheDocument(); // Flag config mapping for commercial
  });

  it('should toggle cost visibility', () => {
    const setShowCost = vi.fn();
    (useStockChartData as any).mockReturnValue({
      ...defaultMockData,
      setShowCost,
    });

    render(<StockHistoryChart productId={mockProductId} />);
    
    const costButton = screen.getByRole('button', { name: /Ver custo/i });
    fireEvent.click(costButton);
    
    expect(setShowCost).toHaveBeenCalledWith(true);
  });

  it('should render demo badge when in demo mode', () => {
    (useStockChartData as any).mockReturnValue({
      ...defaultMockData,
      isDemo: true,
      hasData: false,
    });

    render(<StockHistoryChart productId={mockProductId} />);
    expect(screen.getByText(/dados ilustrativos/i)).toBeInTheDocument();
  });

  it('should allow changing period', () => {
    const setPeriod = vi.fn();
    (useStockChartData as any).mockReturnValue({
      ...defaultMockData,
      setPeriod,
    });

    render(<StockHistoryChart productId={mockProductId} />);
    
    const ninetyDaysTab = screen.getByText('90d');
    fireEvent.click(ninetyDaysTab);
    
    expect(setPeriod).toHaveBeenCalledWith('90');
  });
});
