/**
 * SalesOverviewChart — Visão MACRO de vendas internas
 * Mostra orçamentos vs pedidos agregados de TODOS os vendedores.
 * Estilo igual ao SalesHistoryChart da página de produto.
 */
import { useMemo } from 'react';
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
import { Loader2, ShoppingCart, FileText, DollarSign, Users, Target, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { KpiCard } from '@/components/ui/kpi-card';
import { useSalesHistoryMacro } from '@/hooks/intelligence';
import { safeParseDateForChart } from '@/lib/stock-chart-utils';

interface Props {
  days?: number;
}

export function SalesOverviewChart({ days = 30 }: Props) {
  const { data, isLoading } = useSalesHistoryMacro(days);

  const chartData = useMemo(() => {
    if (!data?.daily?.length) return [];
    return data.daily.reduce<
      Array<(typeof data.daily)[0] & { dateFormatted: string; fullDate: string }>
    >((acc, d) => {
      const parsed = safeParseDateForChart(d.date);
      if (parsed) acc.push({ ...d, ...parsed });
      return acc;
    }, []);
  }, [data]);

  const kpis = data?.kpis;
  const hasData = !!chartData.length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasData && !isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <ShoppingCart className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            📊 Vendas Internas (Macro)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum dado de vendas disponível. Os dados aparecerão quando houver orçamentos e
            pedidos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const safeAvgOrderValue = Number.isFinite(kpis?.avgOrderValue) ? (kpis?.avgOrderValue ?? 0) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <ShoppingCart className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              📊 Vendas Internas (Macro)
            </CardTitle>
            <CardDescription className="mt-1">
              Orçamentos vs Pedidos de toda a equipe · {days} dias
            </CardDescription>
          </div>
          {kpis && kpis.conversionRate > 0 && (
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
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <KpiCard
            icon={FileText}
            label="Orçado (qtd)"
            value={(kpis?.totalQuotedQty ?? 0).toLocaleString('pt-BR')}
            sub={formatCurrency(kpis?.totalQuotedValue ?? 0)}
          />
          <KpiCard
            icon={ShoppingCart}
            label="Vendido (qtd)"
            value={(kpis?.totalOrderedQty ?? 0).toLocaleString('pt-BR')}
            sub={formatCurrency(kpis?.totalOrderedValue ?? 0)}
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
            value={String(kpis?.uniqueSellers ?? 0)}
            sub="ativos"
          />
          <KpiCard
            icon={Target}
            label="Conversão"
            value={`${(kpis?.conversionRate ?? 0).toFixed(1)}%`}
            sub="orç → ped"
          />
          <KpiCard
            icon={Package}
            label="Faturamento"
            value={formatCurrency(kpis?.totalOrderedValue ?? 0)}
            sub="total no período"
            highlight
          />
        </div>

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
              <YAxis yAxisId="value" orientation="right" hide />
              <Tooltip
                content={(props) => (
                  <SalesMacroTooltip
                    active={props.active}
                    payload={props.payload as Array<{ payload: SalesDataPoint }> | undefined}
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
      </CardContent>
    </Card>
  );
}

interface SalesDataPoint {
  quotedQty: number;
  orderedQty: number;
  quotedValue: number;
  orderedValue: number;
  fullDate: string;
}

function SalesMacroTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SalesDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const hasAny = data.quotedQty > 0 || data.orderedQty > 0;

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground">{data.fullDate}</p>
      <div className="mt-2 space-y-1.5">
        {!hasAny && <p className="text-xs italic text-muted-foreground">Sem movimentação</p>}
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
      </div>
    </div>
  );
}
