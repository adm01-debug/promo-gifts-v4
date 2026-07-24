/**
 * CollectionsHeatmap — Sparkline com contagem de itens adicionados por semana (8 últimas).
 */
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface WeekRow {
  week_start: string;
  item_count: number;
}

export function CollectionsHeatmap() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['collections-weekly-count', user?.id],
    queryFn: async (): Promise<WeekRow[]> => {
      if (!user) return [];
      const { data: queryRows, error } = await supabase.rpc('get_collections_weekly_count', {
        _weeks: 8,
      });
      if (error) throw error;
      return (queryRows ?? []) as WeekRow[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.item_count), 1);
  const total = data.reduce((s, d) => s + d.item_count, 0);
  if (total === 0) return null;

  const peakIdx = data.reduce(
    (maxI, d, i, arr) => (d.item_count > arr[maxI].item_count ? i : maxI),
    0,
  );
  const peak = data[peakIdx];
  const peakDate = new Date(peak.week_start);
  const peakMonth = peakDate.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="flex h-8 items-end gap-0.5" aria-label="Histórico semanal de coleções">
        {data.map((d, i) => {
          const h = Math.max(2, (d.item_count / max) * 28);
          const isPeak = i === peakIdx && d.item_count > 0;
          return (
            <div
              key={d.week_start}
              className={cn(
                'w-1.5 rounded-sm transition-all',
                isPeak ? 'bg-primary' : d.item_count > 0 ? 'bg-primary/40' : 'bg-muted',
              )}
              style={{ height: `${h}px` }}
              title={`Semana de ${new Date(d.week_start).toLocaleDateString('pt-BR')}: ${d.item_count} ${d.item_count === 1 ? 'item' : 'itens'}`}
            />
          );
        })}
      </div>
      <div className="flex flex-col">
        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
          <TrendingUp className="h-3 w-3 text-primary" /> {total} adicionados em 8 semanas
        </span>
        <span className="text-[10px] text-muted-foreground">
          Pico em {peakMonth} ({peak.item_count} {peak.item_count === 1 ? 'item' : 'itens'})
        </span>
      </div>
    </div>
  );
}
