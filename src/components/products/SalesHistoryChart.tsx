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
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ShoppingCart,
  FileText,
  Users,
  DollarSign,
  Target,
  Loader2,
  Crown,
  RefreshCw,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { useSalesHistory, type SellerRanking } from '@/hooks/intelligence/useSalesHistory';
import { safeParseDateForChart } from '@/lib/stock-chart-utils';
import { KpiCard } from '@/components/ui/kpi-card';
import { useProductInsights } from '@/hooks/products/useProductInsights';

interface SalesHistoryChartProps {
  productId: string;
  productSku?: string;
  productName?: string;
}

// ---------- Main Component ----------

export function SalesHistoryChart({ productId, productSku }: SalesHistoryChartProps) {
  const [period, setPeriod] = useState<string>('30');
  const days = Number(period);

  const { data, isLoading, error, refetch } = useSalesHistory(productId, days);
  const { data: insights } = useProductInsights(productId, productSku);

  const hasData = !!data?.daily?.length;

  const chartData = useMemo(() => {
    if (!hasData) return [];
    const daily = data?.daily ?? [];
    return daily.reduce<Array<(typeof daily)[0] & { dateFormatted: string; fullDate: string }>>(
      (acc, d) => {
        const parsed = safeParseDateForChart(d.date);
        if (parsed) acc.push({ ...d, ...parsed });
        return acc;
      },
      [],
    );
  }, [data, hasData]);

  const kpis = useMemo(() => {
    if (!hasData)
      return {
        totalQuotedQty: 0,
        totalOrderedQty: 0,
        totalQuotedValue: 0,
        totalOrderedValue: 0,
        conversionRate: 0,
        uniqueSellers: 0,
        avgOrderValue: 0,
        topSellers: [],
      };
    return (
      data?.kpis ?? {
        totalQuotedQty: 0,
        totalOrderedQty: 0,
        totalQuotedValue: 0,
        totalOrderedValue: 0,
        conversionRate: 0,
        uniqueSellers: 0,
        avgOrderValue: 0,
        topSellers: [],
      }
    );
  }, [data, hasData]);

  // Loading
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && !hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            Vendas Internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <ShoppingCart className="h-6 w-6 text-destructive" />
            <p className="text-sm font-medium text-destructive">Erro ao carregar dados de vendas</p>
            <p className="text-xs text-muted-foreground">Tente novamente em alguns instantes</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-1 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!hasData && !isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            Vendas Internas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum dado de vendas disponível ainda. Os dados serão exibidos quando houver orçamentos
            e pedidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  // #8 fix: guard formatCurrency against NaN
  const safeAvgOrderValue = Number.isFinite(kpis.avgOrderValue) ? kpis.avgOrderValue : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Vendas Internas
            </CardTitle>
            <CardDescription className="mt-1">Orçamentos vs Pedidos · {days} dias</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {kpis.conversionRate > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-bold',
                  kpis.conversionRate >= 40
                    ? 'border-primary/30 bg-primary/15 text-primary'
                    : kpis.conversionRate >= 20
                      ? 'border-warning/30 bg-warning/15 text-warning'
                      : 'border-destructive/30 bg-destructive/15 text-destructive',
                )}
              >
                <Target className="mr-1 h-3 w-3" />
                {kpis.conversionRate.toFixed(1)}% conversão
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI cards — 6 metrics in unified grid */}
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-6"
          role="group"
          aria-label="Métricas de vendas internas"
        >
          <KpiCard
            icon={FileText}
            label="Orçado (qtd)"
            value={kpis.totalQuotedQty.toLocaleString('pt-BR')}
            sub={formatCurrency(kpis.totalQuotedValue)}
          />
          <KpiCard
            icon={ShoppingCart}
            label="Vendido (qtd)"
            value={kpis.totalOrderedQty.toLocaleString('pt-BR')}
            sub={formatCurrency(kpis.totalOrderedValue)}
            highlight
          />
          <KpiCard
            icon={DollarSign}
            label="Ticket médio"
            value={formatCurrency(safeAvgOrderValue)}
            sub="por pedido"
          />
          <KpiCard
            icon={Users}
            label="Vendedores"
            value={String(kpis.uniqueSellers)}
            sub="ativos"
          />
          <KpiCard
            icon={Package}
            label="Qtd. Média / Pedido"
            value={String(insights?.averageQuantity || 0)}
            sub="un."
          />
          <KpiCard
            icon={Users}
            label="Segmentos"
            value={insights?.topSegments?.length ? String(insights.topSegments.length) : '0'}
            sub={
              insights?.topSegments?.length
                ? insights.topSegments
                    .slice(0, 2)
                    .map((s) => s.segment)
                    .join(', ')
                : 'Nenhum ainda'
            }
          />
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="h-7 flex-wrap">
            {['15', '30', '60', '90', '120', '180', '360'].map((p) => (
              <TabsTrigger key={p} value={p} className="h-5 px-2 text-xs">
                {p}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Chart */}
        <div className="h-[200px] w-full">
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
                yAxisId="qty"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                width={45}
              />
              <YAxis
                yAxisId="value"
                orientation="right"
                tick={{ fontSize: 10 }}
                className="fill-muted-foreground"
                width={35}
                hide
              />
              <Tooltip content={<SalesTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-[10px] text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                yAxisId="qty"
                dataKey="quotedQty"
                fill="hsl(var(--primary) / 0.25)"
                name="Qtd Orçada"
                radius={[2, 2, 0, 0]}
                barSize={6}
              />
              <Bar
                yAxisId="qty"
                dataKey="orderedQty"
                fill="hsl(var(--primary))"
                name="Qtd Vendida"
                radius={[2, 2, 0, 0]}
                barSize={6}
              />
              <Area
                yAxisId="value"
                type="monotone"
                dataKey="orderedValue"
                stroke="hsl(var(--chart-2, 142 71% 45%))"
                fill="hsl(var(--chart-2, 142 71% 45%) / 0.1)"
                strokeWidth={1.5}
                name="Faturamento"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Top sellers */}
        {kpis.topSellers.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Crown className="h-3 w-3" /> Top Vendedores
            </p>
            <div className="space-y-1">
              {kpis.topSellers.map((seller, i) => (
                <SellerRow key={seller.sellerId} seller={seller} rank={i + 1} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Sub-components ----------

// #1 fix: safe initials extraction — guards against empty sellerName
function SellerRow({ seller, rank }: { seller: SellerRanking; rank: number }) {
  const name = seller.sellerName || 'Vendedor';
  const initials =
    name
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '??';

  return (
    <div className="flex items-center gap-2 rounded-md p-1.5 text-xs transition-colors hover:bg-muted/50">
      <span
        className={cn(
          'w-4 text-center font-bold',
          rank === 1 ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {rank}
      </span>
      <Avatar className="h-5 w-5">
        <AvatarFallback className="bg-primary/10 text-[9px] text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 truncate font-medium text-foreground">{name}</span>
      <span className="text-muted-foreground">{seller.totalQty} un</span>
      <span className="font-semibold text-foreground">{formatCurrency(seller.totalValue)}</span>
      <div className="flex gap-1">
        <Badge variant="outline" className="h-4 px-1 py-0 text-[9px]">
          {seller.quoteCount} orç
        </Badge>
        <Badge variant="secondary" className="h-4 px-1 py-0 text-[9px]">
          {seller.orderCount} ped
        </Badge>
      </div>
    </div>
  );
}

interface ChartDayPayload {
  quotedQty: number;
  orderedQty: number;
  quoteCount: number;
  orderCount: number;
  quotedValue: number;
  orderedValue: number;
  fullDate?: string;
}

// #2 fix: SalesTooltip shows fallback when all values are zero
function SalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDayPayload }[];
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const hasAnyActivity =
    data.quotedQty > 0 || data.orderedQty > 0 || data.quoteCount > 0 || data.orderCount > 0;

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground">{data.fullDate}</p>
      <div className="mt-2 space-y-1.5">
        {!hasAnyActivity && (
          <p className="text-xs italic text-muted-foreground">Sem movimentação neste dia</p>
        )}
        {data.quotedQty > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Orçado:</span>
            <span className="font-semibold">
              {data.quotedQty} un · {formatCurrency(data.quotedValue)}
            </span>
          </div>
        )}
        {data.orderedQty > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-primary">Vendido:</span>
            <span className="font-semibold text-primary">
              {data.orderedQty} un · {formatCurrency(data.orderedValue)}
            </span>
          </div>
        )}
        {data.quoteCount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Orçamentos:</span>
            <span>{data.quoteCount}</span>
          </div>
        )}
        {data.orderCount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pedidos:</span>
            <span>{data.orderCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
