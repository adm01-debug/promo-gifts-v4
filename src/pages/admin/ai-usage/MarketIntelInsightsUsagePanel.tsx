/**
 * MarketIntelInsightsUsagePanel — telemetria do módulo Inteligência de Mercado.
 * Mostra: total de regenerações por dia, top usuários, % cache hit estimado.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Database, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';

interface UsageRow {
  user_id: string;
  event_type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export function MarketIntelInsightsUsagePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-intel-insights-usage'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events } = await supabase
        .from('ai_usage_events')
        .select('user_id, event_type, created_at, metadata')
        .eq('function_name', 'market-intelligence-insights')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);

      const { data: cacheRows } = await supabase
        .from('ai_insights_cache')
        .select('id, created_at, expires_at')
        .eq('function_name', 'market-intelligence-insights')
        .gte('created_at', since);

      return { events: (events ?? []) as UsageRow[], cacheCount: cacheRows?.length ?? 0 };
    },
    staleTime: 1000 * 60 * 2,
  });

  const events = useMemo(() => data?.events ?? [], [data]);
  const cacheCount = data?.cacheCount ?? 0;

  const totalRegens = useMemo(
    () => events.filter((e) => e.event_type === 'manual_regenerate').length,
    [events],
  );
  const uniqueUsers = useMemo(() => new Set(events.map((e) => e.user_id)).size, [events]);
  // Cache hit aproximado: cache rows existentes / (cache rows + regenerations)
  const cacheHitRate = useMemo(
    () =>
      totalRegens + cacheCount > 0
        ? Math.round((cacheCount / (cacheCount + totalRegens)) * 100)
        : 0,
    [totalRegens, cacheCount],
  );

  // Agrupa por dia
  const chartData = useMemo(() => {
    const byDay = events.reduce<Record<string, number>>((acc, e) => {
      const day = e.created_at.slice(0, 10);
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, count]) => ({
        day: new Date(day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        regens: count,
      }));
  }, [events]);

  // Top usuários
  const topUsers = useMemo(() => {
    const byUser = events.reduce<Record<string, number>>((acc, e) => {
      acc[e.user_id] = (acc[e.user_id] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [events]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Insights da IA — Inteligência de Mercado
        </CardTitle>
        <CardDescription>
          Telemetria dos últimos 30 dias da edge function `market-intelligence-insights`.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatTile
                icon={<RefreshCw className="h-4 w-4" />}
                label="Regenerações manuais"
                value={totalRegens}
              />
              <StatTile
                icon={<Users className="h-4 w-4" />}
                label="Usuários únicos"
                value={uniqueUsers}
              />
              <StatTile
                icon={<Database className="h-4 w-4" />}
                label="Cache hit estimado"
                value={`${cacheHitRate}%`}
                hint={`${cacheCount} respostas em cache`}
              />
            </div>

            {chartData.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="regens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {topUsers.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Top usuários (regenerações)
                </p>
                <div className="space-y-1.5">
                  {topUsers.map(([userId, count]) => (
                    <div
                      key={userId}
                      className="flex items-center justify-between rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-xs"
                    >
                      <span className="truncate font-mono">{userId.slice(0, 8)}…</span>
                      <Badge variant="outline">{count} regen.</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Sem eventos de uso registrados ainda.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
