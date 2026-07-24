import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

interface TelemetryRow {
  id: string;
  duration_ms: number;
  severity: string;
  table_name: string | null;
  rpc_name: string | null;
  created_at: string;
}

const BUCKET_MS: Record<string, number> = {
  '1h': 5 * 60 * 1000,
  '6h': 30 * 60 * 1000,
  '24h': 60 * 60 * 1000,
  '7d': 6 * 60 * 60 * 1000,
};

interface TelemetryChartsProps {
  rows: TelemetryRow[];
  timeFilter: string;
}

export function TelemetryCharts({ rows, timeFilter }: TelemetryChartsProps) {
  // Agrupar por intervalo de tempo
  const timelineData = useMemo(() => {
    if (rows.length === 0) return [];

    const bucketMs = BUCKET_MS[timeFilter] ?? BUCKET_MS['7d'];

    const buckets = new Map<
      number,
      {
        slow: number;
        very_slow: number;
        error: number;
        avgMs: number;
        maxMs: number;
        count: number;
        totalMs: number;
      }
    >();

    for (const r of rows) {
      const ts = new Date(r.created_at).getTime();
      const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
      const prev = buckets.get(bucketKey) || {
        slow: 0,
        very_slow: 0,
        error: 0,
        avgMs: 0,
        maxMs: 0,
        count: 0,
        totalMs: 0,
      };

      prev.count++;
      prev.totalMs += r.duration_ms;
      prev.maxMs = Math.max(prev.maxMs, r.duration_ms);
      if (r.severity === 'slow') prev.slow++;
      if (r.severity === 'very_slow') prev.very_slow++;
      if (r.severity === 'error') prev.error++;

      buckets.set(bucketKey, prev);
    }

    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ts, data]) => ({
        time: formatBucketTime(ts, timeFilter),
        timestamp: ts,
        lentas: data.slow,
        muitoLentas: data.very_slow,
        erros: data.error,
        mediaMs: Math.round(data.totalMs / data.count),
        maxMs: data.maxMs,
        total: data.count,
      }));
  }, [rows, timeFilter]);

  // Dados por tabela (para bar chart)
  const tableData = useMemo(() => {
    const stats = new Map<string, { count: number; avgMs: number; totalMs: number }>();
    for (const r of rows) {
      const key = r.rpc_name || r.table_name || 'unknown';
      const prev = stats.get(key) || { count: 0, avgMs: 0, totalMs: 0 };
      prev.count++;
      prev.totalMs += r.duration_ms;
      stats.set(key, prev);
    }
    return [...stats.entries()]
      .map(([name, data]) => ({
        name: name.length > 18 ? `${name.slice(0, 16)}…` : name,
        alertas: data.count,
        mediaMs: Math.round(data.totalMs / data.count),
      }))
      .sort((a, b) => b.alertas - a.alertas)
      .slice(0, 8);
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Timeline de alertas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Alertas ao Longo do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="muitoLentas"
                name="Muito Lentas"
                stackId="1"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="lentas"
                name="Lentas"
                stackId="1"
                stroke="hsl(45, 93%, 47%)"
                fill="hsl(45, 93%, 47%)"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="erros"
                name="Erros"
                stackId="1"
                stroke="hsl(0, 84%, 60%)"
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.3}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Duração média ao longo do tempo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            Duração Média / Máxima (ms)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number) => `${value}ms`}
              />
              <Area
                type="monotone"
                dataKey="maxMs"
                name="Máxima"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.15}
              />
              <Area
                type="monotone"
                dataKey="mediaMs"
                name="Média"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alertas por tabela */}
      {tableData.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Alertas por Tabela
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tableData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number, name: string) =>
                    name === 'mediaMs' ? `${value}ms` : value
                  }
                />
                <Bar
                  dataKey="alertas"
                  name="Alertas"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatBucketTime(ts: number, timeFilter: string): string {
  const d = new Date(ts);
  if (timeFilter === '7d') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
