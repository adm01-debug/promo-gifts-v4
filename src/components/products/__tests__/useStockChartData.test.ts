/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStockChartData } from '../useStockChartData';
import * as intelligenceHooks from '@/hooks/intelligence/useStockHistory';

vi.mock('@/hooks/intelligence/useStockHistory', async () => {
  const actual = await vi.importActual<typeof intelligenceHooks>(
    '@/hooks/intelligence/useStockHistory',
  );
  return {
    ...actual,
    useStockDailySummary: vi.fn(),
    useStockVelocity: vi.fn(),
    useProductIntelligenceData: vi.fn(),
  };
});

vi.mock('@/hooks/products/useSupplierNames', () => ({
  useSupplierNames: vi.fn(() => ({ data: new Map([['S1', 'Supplier One']]) })),
}));

describe('useStockChartData', () => {
  const mockProductId = 'prod_123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default success mocks
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    (intelligenceHooks.useStockDailySummary as any).mockReturnValue({
      data: [{ summary_date: dateStr, supplier_id: 'S1', stock_close: 100, units_depleted: 5 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (intelligenceHooks.useStockVelocity as any).mockReturnValue({
      data: [{ supplier_id: 'S1', avg_daily_depletion_7d: 10, velocity_trend: 1.2 }],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    (intelligenceHooks.useProductIntelligenceData as any).mockReturnValue({
      data: { abc_classification: 'A', turnover_score: 95, total_current_stock: 100 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useStockChartData(mockProductId));

    expect(result.current.period).toBe('30');
    expect(result.current.showCost).toBe(false);
    expect(result.current.selectedSupplier).toBe('all');
  });

  it('should handle period changes', () => {
    const { result } = renderHook(() => useStockChartData(mockProductId));

    act(() => {
      result.current.setPeriod('90');
    });

    expect(result.current.period).toBe('90');
    expect(result.current.days).toBe(90);
    expect(intelligenceHooks.useStockDailySummary).toHaveBeenCalledWith(mockProductId, 90);
  });

  it('should identify Best-Seller (Class A) status', () => {
    const { result } = renderHook(() => useStockChartData(mockProductId));
    expect(result.current.flags).toContain('class-a');
    expect(result.current.turnoverScore).toBe(95);
  });

  it('should calculate market demand level correctly', () => {
    // Very high: >= 20
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({
      data: [{ avg_daily_depletion_7d: 25 }],
    });
    const { result: r1 } = renderHook(() => useStockChartData(mockProductId));
    expect(r1.current.marketDemandLevel).toBe('very-high');

    // High: >= 10
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({
      data: [{ avg_daily_depletion_7d: 15 }],
    });
    const { result: r2 } = renderHook(() => useStockChartData(mockProductId));
    expect(r2.current.marketDemandLevel).toBe('high');

    // Moderate: >= 3
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({
      data: [{ avg_daily_depletion_7d: 5 }],
    });
    const { result: r3 } = renderHook(() => useStockChartData(mockProductId));
    expect(r3.current.marketDemandLevel).toBe('moderate');

    // Low: < 3
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({
      data: [{ avg_daily_depletion_7d: 1 }],
    });
    const { result: r4 } = renderHook(() => useStockChartData(mockProductId));
    expect(r4.current.marketDemandLevel).toBe('low');
  });

  it('should enter demo mode when no data is available', () => {
    (intelligenceHooks.useStockDailySummary as any).mockReturnValue({ data: [], isLoading: false });
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({ data: [] });
    (intelligenceHooks.useProductIntelligenceData as any).mockReturnValue({ data: null });

    const { result } = renderHook(() => useStockChartData(mockProductId));

    expect(result.current.isDemo).toBe(true);
    expect(result.current.hasData).toBe(false);
    expect(result.current.chartData.length).toBeGreaterThan(0); // Should have mock data
  });

  it('should trigger refetch for all queries on retry', () => {
    const refetchSum = vi.fn();
    const refetchVel = vi.fn();
    const refetchInt = vi.fn();

    (intelligenceHooks.useStockDailySummary as any).mockReturnValue({ refetch: refetchSum });
    (intelligenceHooks.useStockVelocity as any).mockReturnValue({ refetch: refetchVel });
    (intelligenceHooks.useProductIntelligenceData as any).mockReturnValue({ refetch: refetchInt });

    const { result } = renderHook(() => useStockChartData(mockProductId));

    act(() => {
      result.current.handleRetry();
    });

    expect(refetchSum).toHaveBeenCalled();
    expect(refetchVel).toHaveBeenCalled();
    expect(refetchInt).toHaveBeenCalled();
  });

  it('should filter chart data by selected supplier', () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    (intelligenceHooks.useStockDailySummary as any).mockReturnValue({
      data: [
        { summary_date: dateStr, supplier_id: 'S1', stock_close: 100 },
        { summary_date: dateStr, supplier_id: 'S2', stock_close: 50 },
      ],
    });

    const { result } = renderHook(() => useStockChartData(mockProductId));

    // Default 'all'
    expect(result.current.chartData[0].stockClose).toBe(150);

    // Select S1
    act(() => {
      result.current.setSelectedSupplier('S1');
    });
    expect(result.current.chartData[0].stockClose).toBe(100);
  });
});
