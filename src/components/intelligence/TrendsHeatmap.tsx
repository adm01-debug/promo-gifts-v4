/**
 * TrendsHeatmap — matriz 7 (dias) × 24 (horas) de atividade.
 * Mostra quando os clientes mais buscam/visualizam.
 */
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import { cn } from '@/lib/utils';

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface TrendsHeatmapProps {
  days: number;
}

export function TrendsHeatmap({ days }: TrendsHeatmapProps) {
  const since = subDays(new Date(), days).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['trends-heatmap', days],
    queryFn: async () => {
      const { isDemoMode, buildMockHeatmap } = await import('@/pages/trends/trends-mock');
      if (isDemoMode()) return buildMockHeatmap();
      const [{ data: views }, { data: searches }] = await Promise.all([
        supabase.from('product_views').select('created_at').gte('created_at', since),
        supabase.from('search_analytics').select('created_at').gte('created_at', since),
      ]);
      // matriz [day][hour]
      const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      const fill = (rows: Array<{ created_at: string }> | null) => {
        rows?.forEach((r) => {
          const d = new Date(r.created_at);
          matrix[d.getDay()][d.getHours()] += 1;
        });
      };
      fill(views);
      fill(searches);
      const flat = matrix.flat();
      const max = Math.max(...flat, 1);
      return { matrix, max };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-chart-3" />
          Mapa de Calor — Quando seus clientes estão ativos
        </CardTitle>
        <CardDescription>
          Eventos por dia da semana × hora (visualizações + buscas) nos últimos {days} dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !data || data.max === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sem dados suficientes para o mapa de calor
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header: horas */}
              <div className="flex gap-px pl-9 text-[9px] text-muted-foreground">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="w-5 text-center">
                    {h % 3 === 0 ? h : ''}
                  </div>
                ))}
              </div>
              {data.matrix.map((row, day) => (
                <div key={day} className="mt-px flex items-center gap-px">
                  <div className="w-9 text-[10px] font-medium text-muted-foreground">
                    {DAYS_PT[day]}
                  </div>
                  {row.map((count, hour) => {
                    const intensity = count / data.max;
                    return (
                      <div
                        key={hour}
                        className={cn(
                          'h-5 w-5 cursor-help rounded-sm transition-transform hover:scale-125',
                          count === 0 && 'bg-muted/40',
                        )}
                        style={
                          count > 0
                            ? {
                                backgroundColor: `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                              }
                            : undefined
                        }
                        title={`${DAYS_PT[day]} ${hour}h — ${count} eventos`}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Legenda */}
              <div className="mt-3 flex items-center gap-2 pl-9 text-[10px] text-muted-foreground">
                <span>menos</span>
                {[0.15, 0.35, 0.55, 0.75, 1].map((i) => (
                  <div
                    key={i}
                    className="h-3 w-4 rounded-sm"
                    style={{ backgroundColor: `hsl(var(--primary) / ${i})` }}
                  />
                ))}
                <span>mais</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
