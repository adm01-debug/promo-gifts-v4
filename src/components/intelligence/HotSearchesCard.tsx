/**
 * HotSearchesCard — Buscas Quentes.
 * Top termos buscados (com resultados) no período. Proxy de interesse real do mercado.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Flame, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { subDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface HotSearchItem {
  term: string;
  searchCount: number;
  previousCount: number;
  delta: number; // % vs período anterior
}

interface HotSearchesCardProps {
  days: number;
}

export function HotSearchesCard({ days }: HotSearchesCardProps) {
  const navigate = useNavigate();
  const since = subDays(new Date(), days).toISOString();
  const previousSince = subDays(new Date(), days * 2).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['hot-searches', days],
    queryFn: async (): Promise<HotSearchItem[]> => {
      const { isDemoMode, MOCK_HOT_SEARCHES } = await import('@/pages/trends/trends-mock');
      if (isDemoMode()) {
        return MOCK_HOT_SEARCHES.map((s) => ({
          term: s.term,
          searchCount: s.count,
          previousCount: Math.max(1, Math.round(s.count / (1 + s.growth / 100))),
          delta: s.growth,
        }));
      }
      const { data: rows, error } = await supabase
        .from('search_analytics')
        .select('search_term, created_at, results_count')
        .gt('results_count', 0)
        .gte('created_at', previousSince)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;

      const recent = new Map<string, number>();
      const previous = new Map<string, number>();
      type SearchAnalyticsRow = {
        search_term: string | null;
        created_at: string;
      };

      ((rows as SearchAnalyticsRow[] | null) ?? []).forEach((r) => {
        const raw = typeof r.search_term === 'string' ? r.search_term : '';
        const key = raw.trim().toLowerCase();
        if (!key) return;
        if (r.created_at >= since) {
          recent.set(key, (recent.get(key) ?? 0) + 1);
        } else {
          previous.set(key, (previous.get(key) ?? 0) + 1);
        }
      });

      return Array.from(recent.entries())
        .map(([term, count]) => {
          const prev = previous.get(term) ?? 0;
          const delta = prev === 0 ? (count > 0 ? 100 : 0) : ((count - prev) / prev) * 100;
          return { term, searchCount: count, previousCount: prev, delta: Math.round(delta) };
        })
        .sort((a, b) => b.searchCount - a.searchCount)
        .slice(0, 10);
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalSearches = data?.reduce((s, item) => s + item.searchCount, 0) ?? 0;

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader className="bg-primary/5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                <Flame className="h-3.5 w-3.5 text-primary" />
              </div>
              Buscas Quentes
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Top termos pesquisados · interesse real em {days} dias
            </CardDescription>
          </div>
          {totalSearches > 0 && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {totalSearches} buscas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <Search className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-xs">Sem dados de busca no período</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((item, index) => {
              const TrendIcon =
                item.delta > 5 ? TrendingUp : item.delta < -5 ? TrendingDown : Minus;
              const trendColor =
                item.delta > 5
                  ? 'text-success'
                  : item.delta < -5
                    ? 'text-destructive'
                    : 'text-muted-foreground';
              return (
                <div
                  key={item.term}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">"{item.term}"</p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {item.searchCount} buscas
                      <span className={cn('inline-flex items-center gap-0.5', trendColor)}>
                        · <TrendIcon className="h-2.5 w-2.5" />
                        {item.delta > 0 ? '+' : ''}
                        {item.delta}%
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 gap-1 text-[10px]"
                    onClick={() => navigate(`/catalogo?busca=${encodeURIComponent(item.term)}`)}
                    aria-label={`Ver catálogo para ${item.term}`}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
