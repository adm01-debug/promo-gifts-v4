/**
 * Detail panel for a single product's supplier risk analysis.
 * Extracted from SupplierRiskPanel for SRP compliance.
 */
import { useMemo, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Loader2,
  Package,
  Clock,
  BarChart3,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  ComposedChart,
  Legend,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useStockDailySummary,
  useStockVelocity,
  useProductIntelligenceData,
  aggregateDailySummaryByDate,
  getActiveFlags,
  type IntelligenceFlag,
  type StockVelocity,
} from '@/hooks/intelligence';
import {
  safeVelocityTrend,
  safeNumber,
  generateMockStockData,
  generateMockVelocity,
  generateMockIntelligence,
  formatVelocityTrendOperational,
  safeParseDateForChart,
  isRealIntelligence,
  OPERATIONAL_FLAG_CONFIG,
  safePriceChanges,
  type MockIntelligenceData,
} from '@/lib/stock-chart-utils';
import { RiskKpi } from './RiskKpi';
import { RiskTooltip } from './RiskTooltip';

interface ProductRiskDetailProps {
  productId: string;
  productName?: string;
}

export function ProductRiskDetail({ productId, productName }: ProductRiskDetailProps) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>('30');
  const [chartExpanded, setChartExpanded] = useState(false);
  const days = Number(period);

  const {
    data: summaries,
    isLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useStockDailySummary(productId, days);
  const {
    data: velocity,
    error: velocityError,
    refetch: refetchVelocity,
  } = useStockVelocity(productId);
  const {
    data: intelligence,
    error: intelligenceError,
    refetch: refetchIntelligence,
  } = useProductIntelligenceData(productId);

  const hasData = !!summaries?.length;
  const hasError = !!(summaryError || velocityError || intelligenceError);
  const isDemo = !hasData && !hasError;

  const handleRetry = () => {
    refetchSummary();
    refetchVelocity();
    refetchIntelligence();
  };

  const mockVelocity = useMemo(() => generateMockVelocity(productId), [productId]);
  const mockIntel = useMemo(() => generateMockIntelligence(productId), [productId]);
  const mockChartData = useMemo(() => generateMockStockData(productId, days), [days, productId]);

  // #10 fix: correct type for reduce — use union type instead of intersection
  const chartData = useMemo(() => {
    if (!hasData) return mockChartData;
    const aggregated = aggregateDailySummaryByDate(summaries ?? []);
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
  }, [summaries, days, hasData, mockChartData]);

  // #9 fix: use mockIntel in demo mode (was `intelligence ?? null`)
  const effectiveIntelligence = intelligence ?? (isDemo ? mockIntel : null);

  const bestVelocity = velocity?.length
    ? velocity.reduce(
        (best: StockVelocity, v: StockVelocity) => (v.avg_daily_depletion_7d > (best?.avg_daily_depletion_7d ?? 0) ? v : best),
        velocity[0],
      )
    : isDemo
      ? mockVelocity
      : null;

  // #9 fix: derive flags from mock data too (was returning [] for non-real)
  const flags = useMemo(() => {
    if (!effectiveIntelligence) return [];
    if (isRealIntelligence(effectiveIntelligence)) {
      return getActiveFlags(effectiveIntelligence);
    }
    // For mock data, manually derive flags
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

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-8"
        role="status"
        aria-label="Carregando detalhes do produto"
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasError && !hasData) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Erro ao carregar dados</p>
        <p className="max-w-[250px] text-xs text-muted-foreground">
          Não foi possível buscar o histórico deste produto. Tente novamente em alguns instantes.
        </p>
        <Button variant="outline" size="sm" onClick={handleRetry} className="mt-1 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const daysToStockout = bestVelocity?.days_to_stockout;
  const isUrgent = daysToStockout !== null && Number.isFinite(daysToStockout) && daysToStockout < 7;
  const isWarning =
    daysToStockout !== null && Number.isFinite(daysToStockout) && daysToStockout < 15;
  const trend = safeVelocityTrend(bestVelocity?.velocity_trend);
  const trendDisplay = formatVelocityTrendOperational(trend);

  // #12 fix: safe price_changes extraction via helper
  const priceChanges = safePriceChanges(bestVelocity);
  const priceChangeText = priceChanges === 1 ? '1 alteração' : `${priceChanges} alterações`;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-semibold">{productName || productId}</h4>
          {isDemo && (
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
              demo
            </Badge>
          )}
          {hasError && hasData && (
            <Badge
              variant="outline"
              className="shrink-0 border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive"
            >
              parcial
            </Badge>
          )}
          {effectiveIntelligence?.abc_classification && (
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px] font-bold',
                effectiveIntelligence.abc_classification === 'A'
                  ? 'border-warning/30 bg-warning/15 text-warning'
                  : effectiveIntelligence.abc_classification === 'B'
                    ? 'border-primary/30 bg-primary/15 text-primary'
                    : 'border-border bg-muted text-muted-foreground',
              )}
            >
              Classe {effectiveIntelligence.abc_classification}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-2 text-[10px]"
          onClick={() => navigate(`/produto/${productId}`)}
        >
          <ExternalLink className="h-3 w-3" />
          Ver produto
        </Button>
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1" role="list" aria-label="Indicadores de risco">
          {flags.map((flag) => {
            const cfg = OPERATIONAL_FLAG_CONFIG[flag];
            const Icon = cfg.icon;
            return (
              <Badge
                key={flag}
                variant="outline"
                className={cn('gap-1 border px-1.5 py-0 text-[10px]', cfg.colors)}
                title={cfg.description}
                role="listitem"
              >
                <Icon className="h-2.5 w-2.5" />
                {cfg.label}
              </Badge>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="group"
        aria-label="Métricas de risco do produto"
      >
        <RiskKpi
          icon={TrendingDown}
          label="Saída/dia (7d)"
          value={safeNumber(bestVelocity?.avg_daily_depletion_7d)?.toFixed(1) ?? '—'}
          sub="unidades"
        />
        <RiskKpi
          icon={Clock}
          label="Dias até acabar"
          value={
            daysToStockout !== null && Number.isFinite(daysToStockout)
              ? String(Math.round(daysToStockout))
              : '∞'
          }
          sub={isUrgent ? 'URGENTE!' : isWarning ? 'atenção' : 'estimativa'}
          alert={isUrgent}
          warning={isWarning && !isUrgent}
        />
        <RiskKpi
          icon={Package}
          label="Estoque atual"
          value={
            effectiveIntelligence?.total_current_stock?.toLocaleString('pt-BR') ??
            bestVelocity?.current_stock?.toLocaleString('pt-BR') ??
            '—'
          }
          sub={
            effectiveIntelligence?.supplier_count
              ? `${effectiveIntelligence.supplier_count} fornecedor${effectiveIntelligence.supplier_count > 1 ? 'es' : ''}`
              : 'no fornecedor'
          }
        />
        <RiskKpi
          icon={
            trend !== null && trend > 1.2
              ? TrendingUp
              : trend !== null && trend < 0.8
                ? TrendingDown
                : BarChart3
          }
          label="Tendência"
          value={trendDisplay.value}
          sub={trendDisplay.label}
        />
      </div>

      {/* Period + Chart */}
      <div className="flex items-center justify-between">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="h-6 flex-wrap">
            {['15', '30', '60', '90', '120', '180'].map((p) => (
              <TabsTrigger key={p} value={p} className="h-4 px-2 text-[10px]">
                {p}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setChartExpanded((prev) => !prev)}
          aria-label={chartExpanded ? 'Minimizar gráfico' : 'Expandir gráfico'}
        >
          {chartExpanded ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          'w-full transition-all duration-300',
          chartExpanded ? 'h-[320px]' : 'h-[140px] sm:h-[160px]',
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: chartExpanded ? 10 : 9 }}
              className="fill-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="stock"
              tick={{ fontSize: chartExpanded ? 10 : 9 }}
              className="fill-muted-foreground"
              width={40}
            />
            <YAxis yAxisId="flow" orientation="right" hide />
            <Tooltip content={<RiskTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: chartExpanded ? '10px' : '9px', paddingTop: '2px' }}
              iconSize={chartExpanded ? 8 : 6}
              formatter={(value: string) => (
                <span className="text-[9px] text-muted-foreground">{value}</span>
              )}
            />
            <Area
              yAxisId="stock"
              type="monotone"
              dataKey="stockClose"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.15)"
              strokeWidth={1.5}
              name="Estoque"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Bar
              yAxisId="flow"
              dataKey="depleted"
              fill="hsl(var(--destructive) / 0.4)"
              name="Saída"
              radius={[2, 2, 0, 0]}
              barSize={chartExpanded ? 5 : 3}
            />
            <Bar
              yAxisId="flow"
              dataKey="restocked"
              fill="hsl(var(--primary) / 0.4)"
              name="Reposição"
              radius={[2, 2, 0, 0]}
              barSize={chartExpanded ? 5 : 3}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Price changes */}
      {priceChanges > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          {priceChangeText} de preço nos últimos 30 dias
        </div>
      )}
    </div>
  );
}
