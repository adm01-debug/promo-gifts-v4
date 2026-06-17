/**
 * UnmetDemandCard — Demanda Reprimida.
 * Top termos buscados que retornaram 0 resultados = oportunidades perdidas.
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Plus } from 'lucide-react';
import { subDays } from 'date-fns';

interface UnmetDemandItem {
  term: string;
  searchCount: number;
  lastSearchedAt: string;
}

interface UnmetDemandCardProps {
  days: number;
}

export function UnmetDemandCard({ days }: UnmetDemandCardProps) {
  const navigate = useNavigate();
  const since = subDays(new Date(), days).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['unmet-demand', days],
    queryFn: async (): Promise<UnmetDemandItem[]> => {
      const { isDemoMode, MOCK_UNMET_DEMAND } = await import('@/pages/trends/trends-mock');
      if (isDemoMode()) {
        const now = new Date().toISOString();
        return MOCK_UNMET_DEMAND.map((d) => ({
          term: d.term,
          searchCount: d.count,
          lastSearchedAt: now,
        }));
      }
      const { data: rows, error } = await supabase
        .from('search_analytics')
        .select('search_term, created_at')
        .eq('results_count', 0)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const map = new Map<string, { count: number; last: string }>();
      type SearchAnalyticsRow = {
        search_term: string | null;
        created_at: string;
      };

      ((rows as SearchAnalyticsRow[] | null) ?? []).forEach((r) => {
        const raw = typeof r.search_term === 'string' ? r.search_term : '';
        const key = raw.trim().toLowerCase();
        if (!key) return;
        const existing = map.get(key) ?? { count: 0, last: r.created_at };
        existing.count += 1;
        if (r.created_at > existing.last) existing.last = r.created_at;
        map.set(key, existing);
      });

      return Array.from(map.entries())
        .map(([term, v]) => ({ term, searchCount: v.count, lastSearchedAt: v.last }))
        .sort((a, b) => b.searchCount - a.searchCount)
        .slice(0, 10);
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalLostSearches = data?.reduce((s, item) => s + item.searchCount, 0) ?? 0;

  return (
    <Card className="overflow-hidden border-warning/30">
      <CardHeader className="bg-warning/5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/20">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              </div>
              Demanda Reprimida
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              Buscas sem resultado · oportunidades perdidas em {days} dias
            </CardDescription>
          </div>
          {totalLostSearches > 0 && (
            <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
              {totalLostSearches} buscas perdidas
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
            <p className="text-xs">Nenhuma busca sem resultado registrada 🎉</p>
            <p className="mt-1 text-[10px] opacity-70">Seu catálogo está cobrindo a demanda</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((item, index) => (
              <div
                key={item.term}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[10px] font-bold text-warning">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">"{item.term}"</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.searchCount} buscas · sem produtos cadastrados
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1 text-[10px]"
                  onClick={() => navigate(`/catalogo?busca=${encodeURIComponent(item.term)}`)}
                  aria-label={`Pesquisar ${item.term} no catálogo`}
                >
                  <Plus className="h-3 w-3" />
                  Verificar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
