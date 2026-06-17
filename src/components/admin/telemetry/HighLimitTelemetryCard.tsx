import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, BarChart3, Filter } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  useHighLimitTelemetry,
  ERROR_KIND_LABEL,
  OPERATION_LABEL,
  type HighLimitFiltersState,
  type OperationFilter,
  type RangePreset,
  type ErrorKindFilter,
} from '@/pages/admin/telemetry/useHighLimitTelemetry';

const RANGE_LABEL: Record<RangePreset, string> = {
  '24h': 'Últimas 24h',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  custom: 'Personalizado',
};

function formatTick(iso: string, bucketMs: number): string {
  const d = new Date(iso);
  if (bucketMs < 3_600_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (bucketMs < 86_400_000)
    return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit' });
  return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
}

const ERROR_KINDS_FOR_STACK: Exclude<ErrorKindFilter, 'all'>[] = [
  'timeout',
  'postgrest_error',
  'validation',
  'network',
  'rate_limit',
  'auth',
  'unknown',
];

const ERROR_COLORS: Record<string, string> = {
  timeout: 'hsl(var(--destructive))',
  postgrest_error: 'hsl(var(--warning))',
  validation: 'hsl(var(--primary))',
  network: 'hsl(var(--accent))',
  rate_limit: 'hsl(var(--muted-foreground))',
  auth: 'hsl(var(--secondary-foreground))',
  unknown: 'hsl(var(--muted))',
};

export function HighLimitTelemetryCard() {
  const [filters, setFilters] = useState<HighLimitFiltersState>({
    operation: 'all',
    range: '7d',
    errorKind: 'all',
  });
  const { data, isLoading, isRefetching } = useHighLimitTelemetry(filters);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => ({
      x: formatTick(p.bucketStartIso, data.bucketMs),
      p50: p.p50,
      p95: p.p95,
      p99: p.p99,
      samples: p.samples,
      recordsAvg: p.recordsAvg,
      ...Object.fromEntries(ERROR_KINDS_FOR_STACK.map((kind) => [kind, p.errorsByKind[kind] ?? 0])),
    }));
  }, [data]);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Listings com limit &gt; 50 — gráficos segmentados
            {isRefetching && (
              <Badge variant="secondary" className="text-[10px]">
                atualizando…
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={filters.operation}
              onValueChange={(v) => setFilters((f) => ({ ...f, operation: v as OperationFilter }))}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OPERATION_LABEL) as OperationFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {OPERATION_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.range}
              onValueChange={(v) => setFilters((f) => ({ ...f, range: v as RangePreset }))}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RANGE_LABEL) as RangePreset[])
                  .filter((k) => k !== 'custom')
                  .map((k) => (
                    <SelectItem key={k} value={k}>
                      {RANGE_LABEL[k]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.errorKind}
              onValueChange={(v) => setFilters((f) => ({ ...f, errorKind: v as ErrorKindFilter }))}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ERROR_KIND_LABEL) as ErrorKindFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {ERROR_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span>
              {new Date(data.fromIso).toLocaleString()} → {new Date(data.toIso).toLocaleString()}
            </span>
            <span>·</span>
            <span>bucket: {Math.round(data.bucketMs / 60000)}min</span>
            <span>·</span>
            <span>
              <Activity className="mr-1 inline h-3 w-3" />
              {data.totals.samples} amostras
            </span>
            <span>·</span>
            <span className={data.totals.errorRate > 0.05 ? 'text-destructive' : ''}>
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {(data.totals.errorRate * 100).toFixed(1)}% erro
            </span>
            <span>·</span>
            <span>p95 {data.totals.p95Ms}ms</span>
            <span>·</span>
            <span>avg {data.totals.avgRecords} records</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-[680px] w-full" />
        ) : !data || data.points.every((p) => p.samples === 0) ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Sem amostras nesta janela com os filtros aplicados.
          </div>
        ) : (
          <>
            {/* Gráfico 1: Latência p50/p95/p99 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Latência (ms) — p50 / p95 / p99
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" dot={false} />
                    <Line type="monotone" dataKey="p95" stroke="hsl(var(--warning))" dot={false} />
                    <Line
                      type="monotone"
                      dataKey="p99"
                      stroke="hsl(var(--destructive))"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Erros empilhados por kind */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Erros por bucket — empilhados por tipo
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {ERROR_KINDS_FOR_STACK.map((kind) => (
                      <Bar
                        key={kind}
                        dataKey={kind}
                        stackId="errors"
                        fill={ERROR_COLORS[kind]}
                        name={ERROR_KIND_LABEL[kind]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 3: Volume (records médios + amostras) */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Volume — registros médios por query e amostras por bucket
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="records" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="samples" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line
                      yAxisId="records"
                      type="monotone"
                      dataKey="recordsAvg"
                      stroke="hsl(var(--primary))"
                      dot={false}
                      name="records (avg)"
                    />
                    <Line
                      yAxisId="samples"
                      type="monotone"
                      dataKey="samples"
                      stroke="hsl(var(--muted-foreground))"
                      dot={false}
                      name="amostras"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
