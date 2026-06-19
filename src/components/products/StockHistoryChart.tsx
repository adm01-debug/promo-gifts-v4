/**
 * StockHistoryChart — Inteligência de Mercado (Página de Produto)
 * Foco COMERCIAL: "como o mercado está comprando este produto"
 */
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Target,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Loader2,
  ShoppingCart,
  BarChart3,
  Star,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeNumber, COMMERCIAL_FLAG_CONFIG } from '@/lib/stock-chart-utils';
import { formatCurrency } from '@/lib/format';
import { KpiCard } from '@/components/ui/kpi-card';
import { SupplierChartFilter } from './SupplierChartFilter';
import { SupplierComparisonCards } from './SupplierComparisonCards';
import { useStockChartData } from './useStockChartData';

interface StockHistoryChartProps {
  productId: string;
  productName?: string;
}

export function StockHistoryChart({ productId }: StockHistoryChartProps) {
  const {
    period,
    setPeriod,
    showCost,
    setShowCost,
    selectedSupplier,
    setSelectedSupplier,
    days,
    loadingSummary,
    hasData,
    hasError,
    isDemo,
    chartData,
    effectiveIntelligence,
    effectiveVelocities,
    bestVelocity,
    flags,
    supplierOptions,
    supplierNamesMap,
    trend,
    trendDisplay,
    marketDemandLevel,
    demandLabel,
    supplierText,
    priceChanges,
    turnoverScore,
    showTurnover,
    handleRetry,
  } = useStockChartData(productId);

  if (loadingSummary) {
    return (
      <Card>
        <CardContent
          className="flex items-center justify-center py-8"
          role="status"
          aria-label="Carregando dados de mercado"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (hasError && !hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Não foi possível carregar dados de mercado
          </p>
          <p className="text-xs text-muted-foreground">Tente novamente em alguns instantes</p>
          <Button variant="outline" size="sm" onClick={handleRetry} className="mt-1 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" aria-hidden="true" />
              Inteligência de Mercado
            </CardTitle>
            <CardDescription className="mt-1">
              Como o mercado está comprando este produto · {days} dias
              {isDemo && (
                <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                  dados ilustrativos
                </Badge>
              )}
              {hasError && hasData && (
                <Badge
                  variant="outline"
                  className="ml-2 border-destructive/30 bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive"
                >
                  dados parciais
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {effectiveIntelligence?.abc_classification && (
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        'cursor-help text-xs font-bold',
                        effectiveIntelligence.abc_classification === 'A'
                          ? 'border-brand-primary/30 bg-brand-primary/15 text-brand-primary'
                          : effectiveIntelligence.abc_classification === 'B'
                            ? 'border-success/30 bg-success/15 text-success'
                            : 'border-border bg-muted text-muted-foreground',
                      )}
                    >
                      {effectiveIntelligence.abc_classification === 'A'
                        ? '🔥 Best-Seller'
                        : effectiveIntelligence.abc_classification === 'B'
                          ? '⚡ Popular'
                          : '📦 Normal'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Classificação ABC baseada no volume de vendas e relevância comercial deste
                    produto no mercado.
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
            )}
            {trend !== null && trend > 1.3 && (
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="cursor-help border-primary/30 bg-primary/15 text-xs font-bold text-primary"
                    >
                      🚀 Emergente
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Este produto está com uma curva de crescimento acelerada nos últimos dias.
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
            )}
            {showTurnover && (
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="cursor-help font-mono text-xs">
                      Potencial: {Math.round(turnoverScore ?? 0)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Potencial comercial: quanto maior este índice, mais o mercado está absorvendo
                    este produto no momento.
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
            )}
          </div>
        </div>

        {flags.length > 0 && (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role="list"
            aria-label="Indicadores de mercado"
          >
            {flags.map((flag) => {
              const cfg = COMMERCIAL_FLAG_CONFIG[flag];
              const Icon = cfg.icon;
              return (
                <Badge
                  key={flag}
                  variant="outline"
                  className={cn('gap-1 border px-2 py-0.5 text-xs', cfg.colors)}
                  title={cfg.description}
                  role="listitem"
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {cfg.label}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI cards */}
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          role="group"
          aria-label="Métricas de inteligência de mercado"
        >
          <KpiCard
            icon={ShoppingCart}
            label="Vendas no mercado"
            value={safeNumber(bestVelocity?.avg_daily_depletion_7d)?.toFixed(1) ?? '—'}
            sub="un/dia (média 7d)"
            highlight={marketDemandLevel === 'very-high' || marketDemandLevel === 'high'}
            ariaLabel={`Vendas no mercado: ${safeNumber(bestVelocity?.avg_daily_depletion_7d)?.toFixed(1) ?? 'indisponível'} unidades por dia`}
            tooltip={
              <>
                Velocidade média de saída do produto considerando a janela dos últimos 7 dias entre
                todos os fornecedores monitorados.
                <br />
                <br />
                <span className="font-semibold italic text-primary">Como usar:</span> quanto maior o
                número, mais aquecido está o giro — bom indicador para garantir lote antes do
                fornecedor esgotar.
              </>
            }
          />
          <KpiCard
            icon={BarChart3}
            label="Demanda"
            value={demandLabel[marketDemandLevel].text}
            sub={
              trend !== null
                ? trend > 1
                  ? '↑ crescendo'
                  : trend < 0.8
                    ? '↓ caindo'
                    : '→ estável'
                : ''
            }
            highlight={marketDemandLevel === 'very-high'}
            customValueColor={demandLabel[marketDemandLevel].color}
            ariaLabel={`Demanda: ${demandLabel[marketDemandLevel].text}`}
            tooltip={
              <>
                Nível de interesse atual:{' '}
                <span className="font-bold">{demandLabel[marketDemandLevel].text}</span>.
                <br />
                <br />
                <span className="font-semibold italic text-primary">Leitura comercial:</span>{' '}
                combina volume de saídas com a tendência da semana — útil para priorizar combos
                quando a procura está alta.
              </>
            }
          />
          <KpiCard
            icon={
              trend !== null && trend > 1.2
                ? TrendingUp
                : trend !== null && trend < 0.8
                  ? TrendingDown
                  : BarChart3
            }
            label="Tendência"
            value={trendDisplay.value}
            sub={trendDisplay.sub}
            highlight={trend !== null && trend > 1.3}
            ariaLabel={`Tendência: ${trendDisplay.value} ${trendDisplay.sub}`}
            tooltip={
              <>
                Variação da procura: <span className="font-bold">{trendDisplay.value}</span> (
                {trendDisplay.sub}).
                <br />
                <br />
                <span className="font-semibold italic text-primary">Como agir:</span> alta de
                procura indica janela para garantir lote antes de eventual ajuste de preço; queda
                cria espaço para negociar condições.
              </>
            }
          />
          <KpiCard
            icon={Star}
            label="Disponível"
            value={effectiveIntelligence?.total_current_stock?.toLocaleString('pt-BR') ?? '—'}
            sub={supplierText}
            ariaLabel={`Disponível: ${effectiveIntelligence?.total_current_stock ?? 'indisponível'} unidades ${supplierText}`}
            tooltip={
              <>
                Estoque total disponível considerando{' '}
                <span className="font-bold">{supplierText}</span>.
                <br />
                <br />
                <span className="font-semibold italic text-primary">Dica:</span> diversificação de
                fornecedores reduz risco de ruptura e dá margem para negociar prazo e custo.
              </>
            }
          />
        </div>

        {/* Period selector + supplier filter */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="h-7 flex-wrap">
              {['15', '30', '60', '90', '120', '180', '360'].map((p) => (
                <TabsTrigger key={p} value={p} className="h-5 px-2 text-xs">
                  {p}d
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {supplierOptions.length > 1 && (
            <SupplierChartFilter
              suppliers={supplierOptions}
              selected={selectedSupplier}
              onSelect={setSelectedSupplier}
            />
          )}
        </div>

        {/* Chart */}
        <div className="h-[160px] w-full sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dateFormatted"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="stock"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                width={50}
              />
              <YAxis yAxisId="flow" orientation="right" hide />
              <Tooltip content={<MarketTooltip showCost={showCost} />} />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-[10px] text-muted-foreground">{value}</span>
                )}
              />
              <Area
                yAxisId="stock"
                type="monotone"
                dataKey="stockClose"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.15)"
                strokeWidth={2}
                name="Disponível"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Bar
                yAxisId="flow"
                dataKey="depleted"
                fill="hsl(var(--destructive) / 0.4)"
                name="Compras do mercado"
                radius={[2, 2, 0, 0]}
                barSize={4}
              />
              <Bar
                yAxisId="flow"
                dataKey="restocked"
                fill="hsl(142 71% 45% / 0.5)"
                name="Reposição"
                radius={[2, 2, 0, 0]}
                barSize={4}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Supplier comparison cards */}
        {effectiveVelocities.length > 1 && supplierNamesMap && (
          <SupplierComparisonCards
            velocities={effectiveVelocities}
            supplierNames={supplierNamesMap}
          />
        )}

        {/* Price change insight + cost toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {priceChanges > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" aria-hidden="true" />
              <span>
                Fornecedor alterou preço {priceChanges}x nos últimos 30 dias —
                <span className="font-medium text-foreground"> trave seu custo ao cotar</span>
                {isDemo && ' (demo)'}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-2 text-[10px] text-muted-foreground"
            onClick={() => setShowCost(!showCost)}
          >
            {showCost ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showCost ? 'Ocultar custo' : 'Ver custo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MarketTooltip({
  active,
  payload,
  showCost,
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, number> }>;
  showCost: boolean;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const depleted = safeNumber(data.depleted);
  const restocked = safeNumber(data.restocked);
  const hasActivity = (depleted !== null && depleted > 0) || (restocked !== null && restocked > 0);

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground">{data.fullDate}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Disponível:</span>
          <span className="font-semibold">
            {data.stockClose?.toLocaleString('pt-BR') ?? '—'} un
          </span>
        </div>
        {!hasActivity && (
          <p className="text-[10px] italic text-muted-foreground">Sem movimentação neste dia</p>
        )}
        {depleted !== null && depleted > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-destructive">Compras do mercado:</span>
            <span className="font-semibold text-destructive">-{depleted}</span>
          </div>
        )}
        {restocked !== null && restocked > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-primary">Reposição:</span>
            <span className="font-semibold text-primary">+{restocked}</span>
          </div>
        )}
        {data.restockDetected && (
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
          >
            🔄 Fornecedor reabasteceu
          </Badge>
        )}
        {showCost && data.costPriceClose !== null && (
          <div className="flex justify-between border-t border-border pt-1 text-xs">
            <span className="text-muted-foreground">Custo base:</span>
            <span className="font-semibold">{formatCurrency(data.costPriceClose)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
