/**
 * Business logic hook for StockHistoryChart.
 * Extracts data fetching, mock data generation, and derived insights.
 */
import { useMemo, useState } from 'react';
import {
  useStockDailySummary,
  useStockVelocity,
  useProductIntelligenceData,
  aggregateDailySummaryByDate,
  extractUniqueSupplierIds,
  getActiveFlags,
  type IntelligenceFlag,
  type StockVelocity,
  type ProductIntelligenceData,
} from '@/hooks/intelligence/useStockHistory';
import { useSupplierNames } from '@/hooks/products/useSupplierNames';
import {
  safeVelocityTrend,
  safeNumber,
  generateMockStockData,
  generateMockVelocities,
  generateMockIntelligence,
  generateMockSupplierNames,
  formatVelocityTrendCommercial,
  safeParseDateForChart,
  isRealIntelligence,
  safePriceChanges,
  type MockIntelligenceData,
} from '@/lib/stock-chart-utils';

export function useStockChartData(productId: string) {
  const [period, setPeriod] = useState<string>('30');
  const [showCost, setShowCost] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const days = Number(period);

  const {
    data: summaries,
    isLoading: loadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useStockDailySummary(productId, days);
  const {
    data: _velocity,
    error: velocityError,
    refetch: refetchVelocity,
  } = useStockVelocity(productId);
  const velocity = _velocity as StockVelocity[] | undefined;
  const {
    data: _intelligence,
    error: intelligenceError,
    refetch: refetchIntelligence,
  } = useProductIntelligenceData(productId);
  const intelligence = _intelligence as ProductIntelligenceData | null | undefined;

  const hasData = !!summaries?.length;
  const hasError = !!(summaryError || velocityError || intelligenceError);
  const isDemo = !hasData && !hasError;

  // Mock data
  const mockVelocities = useMemo(() => generateMockVelocities(productId), [productId]);
  const mockIntel = useMemo(() => generateMockIntelligence(productId), [productId]);
  const mockSupplierNames = useMemo(() => generateMockSupplierNames(productId), [productId]);

  // Supplier names
  const supplierIds = useMemo(
    () =>
      hasData
        ? extractUniqueSupplierIds(summaries ?? [])
        : isDemo
          ? mockVelocities.map((v) => v.supplier_id)
          : [],
    [summaries, hasData, isDemo, mockVelocities],
  );
  const { data: realSupplierNamesMap } = useSupplierNames(hasData ? supplierIds : []);
  const supplierNamesMap = hasData ? realSupplierNamesMap : isDemo ? mockSupplierNames : undefined;

  const supplierOptions = useMemo(() => {
    if (supplierIds.length <= 1) return [];
    return supplierIds.map((id) => ({
      id,
      name: supplierNamesMap?.get(id) ?? `Fornecedor ${id.slice(0, 6)}`,
    }));
  }, [supplierIds, supplierNamesMap]);

  // Chart data
  const mockChartData = useMemo(() => generateMockStockData(productId, days), [days, productId]);

  const chartData = useMemo(() => {
    if (!hasData) return mockChartData;
    const supplierId = selectedSupplier === 'all' ? undefined : selectedSupplier;
    const aggregated = aggregateDailySummaryByDate(summaries ?? [], supplierId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return aggregated
      .filter((d) => new Date(d.date) >= cutoff)
      .reduce<
        Array<{
          date: string;
          stockClose: number;
          depleted: number;
          restocked: number;
          restockDetected: boolean;
          costPriceClose: number | null;
          dateFormatted: string;
          fullDate: string;
        }>
      >((acc, d) => {
        const parsed = safeParseDateForChart(d.date);
        if (parsed) acc.push({ ...d, ...parsed });
        return acc;
      }, []);
  }, [summaries, days, hasData, mockChartData, selectedSupplier]);

  // Effective data
  const effectiveIntelligence = intelligence ?? (isDemo ? mockIntel : null);
  const effectiveVelocities = useMemo(
    () => (velocity?.length ? velocity : isDemo ? mockVelocities : []),
    [velocity, isDemo, mockVelocities],
  );

  const bestVelocity = useMemo(() => {
    if (effectiveVelocities.length) {
      if (selectedSupplier !== 'all') {
        const match = effectiveVelocities.find(
          (v: StockVelocity) => v.supplier_id === selectedSupplier,
        );
        if (match) return match;
      }
      return effectiveVelocities.reduce(
        (best: StockVelocity, v: StockVelocity) =>
          v.avg_daily_depletion_7d > (best?.avg_daily_depletion_7d ?? 0) ? v : best,
        effectiveVelocities[0],
      );
    }
    return null;
  }, [effectiveVelocities, selectedSupplier]);

  const flags = useMemo(() => {
    if (!effectiveIntelligence) return [];
    if (isRealIntelligence(effectiveIntelligence)) {
      return getActiveFlags(effectiveIntelligence);
    }
    const mock = effectiveIntelligence as MockIntelligenceData;
    const result: IntelligenceFlag[] = [];
    if (mock.is_hot_product) result.push('hot-product');
    if (mock.is_stockout_risk) result.push('stockout-risk');
    if (mock.is_stagnant) result.push('stagnant');
    if (mock.is_negotiation_opportunity) result.push('negotiation-opportunity');
    if (mock.has_frequent_restock) result.push('frequent-restock');
    if (mock.abc_classification === 'A') result.push('class-a');
    return result;
  }, [effectiveIntelligence]);

  // Derived commercial insights
  const trend = safeVelocityTrend(bestVelocity?.velocity_trend);
  const trendDisplay = formatVelocityTrendCommercial(trend);

  const marketDemandLevel = useMemo(() => {
    if (!bestVelocity) return 'unknown';
    const v = safeNumber(bestVelocity.avg_daily_depletion_7d);
    if (v === null) return 'unknown';
    if (v >= 20) return 'very-high';
    if (v >= 10) return 'high';
    if (v >= 3) return 'moderate';
    return 'low';
  }, [bestVelocity]);

  const demandLabel: Record<string, { text: string; color: string }> = {
    'very-high': { text: 'Muito Alta', color: 'text-destructive' },
    high: { text: 'Alta', color: 'text-warning' },
    moderate: { text: 'Moderada', color: 'text-primary' },
    low: { text: 'Baixa', color: 'text-muted-foreground' },
    unknown: { text: '—', color: 'text-muted-foreground' },
  };

  const supplierText = useMemo(() => {
    if (selectedSupplier !== 'all' && supplierNamesMap) {
      const name = supplierNamesMap.get(selectedSupplier);
      return name ? `em ${name}` : 'fornecedor selecionado';
    }
    const count = effectiveIntelligence?.supplier_count;
    if (!count) return 'no fornecedor';
    return `em ${count} fornecedor${count > 1 ? 'es' : ''}`;
  }, [effectiveIntelligence, selectedSupplier, supplierNamesMap]);

  const priceChanges = safePriceChanges(bestVelocity);

  const handleRetry = () => {
    refetchSummary();
    refetchVelocity();
    refetchIntelligence();
  };

  const turnoverScore = effectiveIntelligence?.turnover_score;
  const showTurnover = turnoverScore !== null && Number.isFinite(turnoverScore);

  return {
    // State
    period,
    setPeriod,
    showCost,
    setShowCost,
    selectedSupplier,
    setSelectedSupplier,
    days,

    // Loading/error
    loadingSummary,
    hasData,
    hasError,
    isDemo,

    // Data
    chartData,
    effectiveIntelligence,
    effectiveVelocities: effectiveVelocities as StockVelocity[],
    bestVelocity,
    flags,
    supplierOptions,
    supplierNamesMap,

    // Derived
    trend,
    trendDisplay,
    marketDemandLevel,
    demandLabel,
    supplierText,
    priceChanges,
    turnoverScore,
    showTurnover,

    // Actions
    handleRetry,
  };
}
