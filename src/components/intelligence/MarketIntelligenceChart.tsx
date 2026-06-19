/**
 * MarketIntelligenceChart — Visão MACRO de mercado
 * Replica o layout do StockHistoryChart (página de produto)
 * mas com dados agregados de todos os produtos.
 * Inclui mock data quando não há dados reais.
 */
import { useMemo, useState } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  ShoppingCart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatTooltipNumber, formatTooltipPercent } from '@/lib/format-utils';
import {
  useMarketIntelligenceMacro,
  type MacroMarketPoint,
  type MacroSupplierMetrics,
  type MacroMarketKpis,
} from '@/hooks/intelligence/useMarketIntelligenceMacro';
import { useSupplierNames } from '@/hooks/products/useSupplierNames';
import { safeParseDateForChart } from '@/lib/stock-chart-utils';
import { SupplierChartFilter } from '@/components/products/SupplierChartFilter';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  days?: number;
  supplierId?: string | null;
  productId?: string | null;
}

// ---------- Mock data generator ----------
function generateMockMarketData(days: number) {
  const daily: MacroMarketPoint[] = [];
  const now = new Date();
  let stock = 3200 + Math.floor(Math.random() * 800);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseDepleted = isWeekend ? 15 : 45;
    const depleted = Math.max(0, Math.round(baseDepleted + (Math.random() - 0.4) * 30));
    const restocked = Math.random() > 0.85 ? Math.round(200 + Math.random() * 400) : 0;

    stock = Math.max(100, stock - depleted + restocked);

    daily.push({ date: dateStr, stockClose: stock, depleted, restocked });
  }

  const d7 = daily.slice(-7);
  const totalDepleted7d = d7.reduce((s, p) => s + p.depleted, 0);
  const totalDepleted30d = daily.reduce((s, p) => s + p.depleted, 0);
  const totalRestocked30d = daily.reduce((s, p) => s + p.restocked, 0);
  const activeDays = daily.filter((d) => d.depleted > 0).length;

  const topDay = daily.reduce(
    (best, d) => (d.depleted > (best?.depleted ?? 0) ? d : best),
    daily[0],
  );

  const mockSuppliers: MacroSupplierMetrics[] = [
    {
      supplierId: 'mock-supplier-1',
      avgDailyDepletion7d: 10.2,
      currentStock: 659,
      totalDepleted: 420,
      totalRestocked: 200,
      velocityTrend: 1.26,
      daysToStockout: 64,
    },
    {
      supplierId: 'mock-supplier-2',
      avgDailyDepletion7d: 9.1,
      currentStock: 413,
      totalDepleted: 350,
      totalRestocked: 150,
      velocityTrend: 1.15,
      daysToStockout: 45,
    },
    {
      supplierId: 'mock-supplier-3',
      avgDailyDepletion7d: 8.7,
      currentStock: 362,
      totalDepleted: 310,
      totalRestocked: 100,
      velocityTrend: 0.52,
      daysToStockout: 41,
    },
    {
      supplierId: 'mock-supplier-4',
      avgDailyDepletion7d: 3.5,
      currentStock: 424,
      totalDepleted: 140,
      totalRestocked: 80,
      velocityTrend: 0.95,
      daysToStockout: 121,
    },
  ];

  const kpis: MacroMarketKpis = {
    totalDepleted7d,
    totalDepleted30d,
    totalRestocked30d,
    totalCurrentStock: stock,
    avgDailyDepletion: activeDays > 0 ? totalDepleted30d / activeDays : 0,
    supplierCount: 4,
    topDepletionDay: { date: topDay.date, value: topDay.depleted },
  };

  const mockSupplierNames = new Map<string, string>([
    ['mock-supplier-1', 'Brasil Brindes'],
    ['mock-supplier-2', 'Master Promo'],
    ['mock-supplier-3', 'Premium Gifts'],
    ['mock-supplier-4', 'Master Promo'],
  ]);

  return {
    daily,
    kpis,
    suppliers: mockSuppliers,
    supplierIds: mockSuppliers.map((s) => s.supplierId),
    supplierNames: mockSupplierNames,
  };
}

export function MarketIntelligenceChart({
  days: defaultDays = 30,
  supplierId,
  productId: _productId,
}: Props) {
  const [period, setPeriod] = useState<string>(String(defaultDays));
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const days = Number(period);

  const { data: realData, isLoading, error } = useMarketIntelligenceMacro(days, supplierId);

  // Mock data fallback
  const mock = useMemo(() => generateMockMarketData(days), [days]);
  const hasRealData = !!realData?.daily?.length;
  const isDemo = !hasRealData && !error;

  const effectiveData = hasRealData ? realData : mock;
  const effectiveSupplierNames = hasRealData ? null : mock.supplierNames;

  // Supplier names (only fetch for real data)
  const { data: realSupplierNamesMap } = useSupplierNames(
    hasRealData ? (realData?.supplierIds ?? []) : [],
  );
  const supplierNamesMap = hasRealData ? realSupplierNamesMap : effectiveSupplierNames;

  const supplierOptions = useMemo(() => {
    const ids = effectiveData?.supplierIds ?? [];
    if (ids.length <= 1) return [];
    return ids.map((id) => ({
      id,
      name: supplierNamesMap?.get(id) ?? `Fornecedor ${id.slice(0, 6)}`,
    }));
  }, [effectiveData?.supplierIds, supplierNamesMap]);

  const chartData = useMemo(() => {
    if (!effectiveData?.daily?.length) return [];
    return effectiveData.daily.reduce<
      Array<(typeof effectiveData.daily)[0] & { dateFormatted: string; fullDate: string }>
    >((acc, d) => {
      const parsed = safeParseDateForChart(d.date);
      if (parsed) acc.push({ ...d, ...parsed });
      return acc;
    }, []);
  }, [effectiveData]);

  const supplierText = useMemo(() => {
    const count = effectiveData?.kpis?.supplierCount ?? 0;
    if (count === 0) return 'no fornecedor';
    return `em ${count} fornecedor${count > 1 ? 'es' : ''}`;
  }, [effectiveData?.kpis?.supplierCount]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && !hasRealData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">Erro ao carregar dados de mercado</p>
          <p className="text-xs text-muted-foreground">Verifique a conexão e tente novamente</p>
        </CardContent>
      </Card>
    );
  }

  const kpis = effectiveData?.kpis;
  const hasData = !!chartData.length;

  // Market demand level
  const avgDepletion = kpis?.avgDailyDepletion ?? 0;
  const demandLevel =
    avgDepletion >= 50
      ? 'Muito Alta'
      : avgDepletion >= 20
        ? 'Alta'
        : avgDepletion >= 5
          ? 'Moderada'
          : 'Baixa';
  const demandColor =
    avgDepletion >= 50
      ? 'text-destructive'
      : avgDepletion >= 20
        ? 'text-warning'
        : avgDepletion >= 5
          ? 'text-primary'
          : 'text-muted-foreground';

  // Trend: compare 7d vs 30d depletion rate
  const trend7d = (kpis?.totalDepleted7d ?? 0) / 7;
  const trend30d = (kpis?.totalDepleted30d ?? 0) / Math.max(days, 1);
  const trendRatio = trend30d > 0 ? trend7d / trend30d : 1;
  const trendPercent = Math.round((trendRatio - 1) * 100);
  const trendLabel =
    trendRatio > 1.2 ? '↑ acelerando' : trendRatio < 0.8 ? '↓ desacelerando' : '→ estável';

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
              Como o mercado está comprando · visão macro · {days} dias
              {isDemo && (
                <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[10px]">
                  dados ilustrativos
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendRatio > 1.3 && (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/15 text-xs font-bold text-primary"
              >
                🚀 Mercado Aquecido
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI Cards */}
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          role="group"
          aria-label="Métricas de inteligência de mercado"
        >
          <KpiCard
            icon={ShoppingCart}
            label="Vendas no mercado"
            value={isLoading ? '...' : formatTooltipNumber(avgDepletion, 1)}
            sub="un/dia (média 7d)"
            highlight={avgDepletion >= 20}
            tooltip={
              isLoading ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  Velocidade média de saída:{' '}
                  <span className="font-bold">{formatTooltipNumber(avgDepletion, 1)} un/dia</span>.
                  <br />
                  <br />
                  <span className="font-semibold italic text-primary">Dica de Argumentação:</span>
                  {avgDepletion > 30
                    ? ` "Este produto está voando com ${formatTooltipNumber(avgDepletion, 1)} saídas/dia! Recomendo garantir o lote agora para não perder o timing de venda."`
                    : avgDepletion > 0
                      ? ` "Temos um giro saudável de ${formatTooltipNumber(avgDepletion, 1)} unidades/dia. É um item de segurança para o seu estoque base."`
                      : ' Sem registros de saída recente no mercado. Pode ser uma oportunidade de nicho ou aguardando reposição.'}
                </>
              )
            }
          />
          <KpiCard
            icon={BarChart3}
            label="Demanda"
            value={isLoading ? '...' : demandLevel}
            sub={trendLabel}
            customValueColor={demandColor}
            tooltip={
              isLoading ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  Nível de interesse:{' '}
                  <span className="font-bold">{demandLevel || 'Sem dados'}</span>.
                  <br />
                  <br />
                  <span className="font-semibold italic text-primary">Cenário Prático:</span>
                  {demandLevel === 'Muito Alta' || demandLevel === 'Alta'
                    ? ` "Interesse ${demandLevel} detectado! Ótimo momento para combos, aproveitando que a busca orgânica está no pico."`
                    : demandLevel === 'Moderada'
                      ? ' "Demanda equilibrada. Momento ideal para manter o estoque de segurança e focar em vendas consultivas."'
                      : ' "Interesse em fase inicial ou baixa. Foco em ações de marketing para despertar o desejo no seu cliente."'}
                </>
              )
            }
          />
          <KpiCard
            icon={trendRatio > 1.2 ? TrendingUp : trendRatio < 0.8 ? TrendingDown : BarChart3}
            label="Tendência"
            value={isLoading ? '...' : formatTooltipPercent(trendPercent)}
            sub={
              trendRatio > 1
                ? 'demanda crescente'
                : trendRatio < 0.8
                  ? 'demanda caindo'
                  : 'demanda estável'
            }
            highlight={trendRatio > 1.3}
            tooltip={
              isLoading ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  Variação da procura:{' '}
                  <span className="font-bold">{formatTooltipPercent(trendPercent)}</span>.
                  <br />
                  <br />
                  <span className="font-semibold italic text-primary">Como agir:</span>
                  {trendPercent > 15
                    ? ` "A procura subiu ${formatTooltipPercent(trendPercent)} esta semana! Se esperarmos, o preço pode subir ou o lote esgotar rápido."`
                    : trendPercent < -15
                      ? ` "Notamos um recuo de ${formatTooltipPercent(trendPercent)}. É a janela perfeita para negociarmos uma condição agressiva."`
                      : ' O mercado segue estável. Temos previsibilidade total de custos e prazos para o seu pedido hoje.'}
                </>
              )
            }
          />
          <KpiCard
            icon={Package}
            label="Disponível"
            value={isLoading ? '...' : formatTooltipNumber(kpis?.totalCurrentStock, 0)}
            sub={supplierText}
            tooltip={
              isLoading ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  Estoque global:{' '}
                  <span className="font-bold">
                    {formatTooltipNumber(kpis?.totalCurrentStock, 0)} un
                  </span>
                  .
                  <br />
                  Duração estimada:{' '}
                  <span className="font-bold">
                    {avgDepletion > 0
                      ? Math.round((kpis?.totalCurrentStock ?? 0) / avgDepletion)
                      : '---'}{' '}
                    dias
                  </span>
                  .
                  <br />
                  <br />
                  <span className="font-semibold italic text-primary">Gatilho de Venda:</span>
                  {avgDepletion > 0 && (kpis?.totalCurrentStock ?? 0) / avgDepletion < 15
                    ? ` "Urgente: Restam só ${formatTooltipNumber(kpis?.totalCurrentStock, 0)} unidades no mercado (menos de 15 dias). Garanta sua cota!"`
                    : ` "Estoque de ${formatTooltipNumber(kpis?.totalCurrentStock, 0)} un disponível. A tendência sugere que este é o momento seguro para reposição."`}
                </>
              )
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
        {!hasData ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Sem dados de mercado disponíveis para este período
          </div>
        ) : (
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
                <Tooltip
                  content={(props) => (
                    <MarketMacroTooltip
                      active={props.active}
                      payload={props.payload as Array<{ payload: MarketDataPoint }> | undefined}
                    />
                  )}
                />
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
        )}

        {/* Supplier Comparison Cards */}
        {effectiveData?.suppliers && effectiveData.suppliers.length > 1 && supplierNamesMap && (
          <MacroSupplierComparison
            suppliers={effectiveData.suppliers}
            supplierNames={supplierNamesMap}
          />
        )}

        {/* Insight */}
        {kpis?.topDepletionDay && (
          <p className="text-xs text-muted-foreground">
            📊 Pico de saídas:{' '}
            <span className="font-medium text-foreground">
              {kpis.topDepletionDay.value.toLocaleString('pt-BR')} un
            </span>{' '}
            em{' '}
            {new Date(`${kpis.topDepletionDay.date}T00:00:00`).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })}
            {isDemo && ' (demo)'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Supplier Comparison (macro version) ----------

function MacroSupplierComparison({
  suppliers,
  supplierNames,
}: {
  suppliers: MacroSupplierMetrics[];
  supplierNames: Map<string, string>;
}) {
  const COLORS = [
    'border-l-primary',
    'border-l-destructive',
    'border-l-emerald-500',
    'border-l-amber-500',
    'border-l-violet-500',
    'border-l-cyan-500',
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Comparativo por Fornecedor
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s, idx) => {
          const name = supplierNames.get(s.supplierId) ?? `Fornecedor ${s.supplierId.slice(0, 6)}`;
          const isBest = idx === 0 && suppliers.length > 1;

          return (
            <div
              key={s.supplierId}
              className={cn(
                'flex flex-col gap-1 rounded-md border-l-2 bg-muted/40 p-2',
                COLORS[idx % COLORS.length],
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="max-w-[120px] truncate text-xs font-medium" title={name}>
                  {name}
                </span>
                {isBest && (
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 px-1 py-0 text-[9px] text-primary"
                  >
                    Maior saída
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div>
                  <p className="text-muted-foreground">Saída/dia</p>
                  <p className="font-bold text-foreground">{s.avgDailyDepletion7d.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estoque</p>
                  <p className="font-bold text-foreground">
                    {s.currentStock.toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tendência</p>
                  <p
                    className={cn(
                      'flex items-center gap-0.5 font-bold',
                      s.velocityTrend > 1
                        ? 'text-primary'
                        : s.velocityTrend < 0.8
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                    )}
                  >
                    {s.velocityTrend > 1 ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : s.velocityTrend < 0.8 ? (
                      <TrendingDown className="h-2.5 w-2.5" />
                    ) : (
                      <Minus className="h-2.5 w-2.5" />
                    )}
                    {((s.velocityTrend - 1) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {s.daysToStockout !== null && s.daysToStockout < 30 && (
                <p
                  className={cn(
                    'flex items-center gap-1 text-[9px]',
                    s.daysToStockout < 7 ? 'text-destructive' : 'text-warning',
                  )}
                >
                  <Package className="h-2.5 w-2.5" />
                  {s.daysToStockout < 7 ? '⚠️' : '⏳'} Esgota em ~{s.daysToStockout}d
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tooltip ----------

interface MarketDataPoint {
  fullDate: string;
  stockClose: number;
  depleted: number;
  restocked: number;
}

function MarketMacroTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: MarketDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground">{data.fullDate}</p>
      <div className="mt-2 space-y-1.5">
        {data.stockClose > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Disponível:</span>
            <span className="font-semibold">{data.stockClose.toLocaleString('pt-BR')} un</span>
          </div>
        )}
        {data.depleted > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-destructive">Compras mercado:</span>
            <span className="font-semibold text-destructive">
              {data.depleted.toLocaleString('pt-BR')} un
            </span>
          </div>
        )}
        {data.restocked > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-primary">Reposição:</span>
            <span className="font-semibold text-primary">
              {data.restocked.toLocaleString('pt-BR')} un
            </span>
          </div>
        )}
        {data.depleted === 0 && data.restocked === 0 && (
          <p className="text-xs italic text-muted-foreground">Sem movimentação</p>
        )}
      </div>
    </div>
  );
}
