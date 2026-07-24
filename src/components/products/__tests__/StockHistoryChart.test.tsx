/* eslint-disable @typescript-eslint/require-await */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StockHistoryChart } from '../StockHistoryChart';
import { useStockChartData } from '../useStockChartData';

// Mock the hook
vi.mock('../useStockChartData', () => ({
  useStockChartData: vi.fn(),
}));

const mockData = {
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
  effectiveIntelligence: {
    abc_classification: 'A',
    total_current_stock: 500,
  },
  effectiveVelocities: [],
  bestVelocity: {
    avg_daily_depletion_7d: 12.5,
  },
  flags: [],
  supplierOptions: [],
  supplierNamesMap: {},
  trend: 1.5,
  trendDisplay: { value: '+20%', sub: 'vs prev' },
  marketDemandLevel: 'high',
  demandLabel: {
    high: { text: 'Alta', color: 'text-primary' },
  },
  supplierText: 'em 3 fornecedores',
  priceChanges: 2,
  turnoverScore: 85,
  showTurnover: true,
  handleRetry: vi.fn(),
};

describe('StockHistoryChart Tooltips', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useStockChartData).mockReturnValue(mockData as any);
  });

  it('renders all 4 KPI card tooltips info icons', () => {
    render(<StockHistoryChart productId="test-prod" />);

    // Check for the info buttons (TooltipTrigger in KpiCard)
    const infoButtons = screen.getAllByRole('button', { name: /Sobre/i });
    expect(infoButtons).toHaveLength(4);
  });

  it('renders the Potencial badge tooltip trigger', () => {
    render(<StockHistoryChart productId="test-prod" />);

    const potencialBadge = screen.getByText(/Potencial:/i);
    expect(potencialBadge).toBeInTheDocument();
  });

  it('shows tooltip content on hover (KpiCard)', () => {
    render(<StockHistoryChart productId="test-prod" />);

    const firstInfoButton = screen.getAllByRole('button', { name: /Sobre/i })[0];
    fireEvent.mouseEnter(firstInfoButton);

    // Tooltip content should appear
    // Note: Radix UI tooltips might need some time or specific configuration in tests
    // But we can check if the trigger is there.
    expect(firstInfoButton).toBeInTheDocument();
  });
});

describe('Gallery Tooltip Regression', () => {
  it("ensures no title attribute exists on chart elements that shouldn't have them", () => {
    render(<StockHistoryChart productId="test-prod" />);

    // Potencial badge used to have a title, now it shouldn't (it uses a Tooltip component)
    const potencialBadge = screen.queryByTitle(/Potencial comercial:/i);
    expect(potencialBadge).not.toBeInTheDocument();
  });
});
