/**
 * MyDiscountRequestsWidget — solicitações de desconto do usuário com busca,
 * filtros e infinite scroll. Filtro explícito por seller_id = auth.uid().
 */
import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Percent, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  WidgetFiltersBar,
  EMPTY_FILTERS,
  matchesSearch,
  withinDateRange,
  type WidgetFiltersValue,
} from './widget-filters/WidgetFiltersBar';
import { useInfiniteScroll } from './widget-filters/useInfiniteScroll';

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function MyDiscountRequestsWidget() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WidgetFiltersValue>(EMPTY_FILTERS);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['my-discount-requests-widget', userId],
    enabled: !!userId,
    staleTime: 30_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!userId) return [];
      let q = supabase
        .from('discount_approval_requests')
        .select('id, status, requested_discount_percent, quote_id, created_at')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data: queryRows, error } = await q;
      if (error) throw error;
      return queryRows ?? [];
    },
    getNextPageParam: (last) =>
      last.length < PAGE_SIZE ? undefined : (last[last.length - 1]?.created_at ?? undefined),
  });

  const all = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filtered = useMemo(() => {
    return all.filter(
      (r) =>
        (filters.status === 'all' || r.status === filters.status) &&
        withinDateRange(r.created_at, filters.dateRange) &&
        matchesSearch(
          [r.quote_id, String(Number(r.requested_discount_percent ?? 0).toFixed(1))],
          filters.search,
        ),
    );
  }, [all, filters]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const sentinelRef = useInfiniteScroll(handleLoadMore, {
    enabled: !!hasNextPage,
  });

  if (!isLoading && all.length === 0) return null;

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Percent className="h-4 w-4 text-primary" />
            Minhas Solicitações de Desconto
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/descontos')}
            className="gap-1 text-xs"
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <WidgetFiltersBar
          value={filters}
          onChange={setFilters}
          statusOptions={STATUS_OPTIONS}
          searchPlaceholder="Buscar por % ou orçamento…"
        />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhuma solicitação encontrada com os filtros atuais.
            </p>
          ) : (
            filtered.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <Percent className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    Desconto solicitado: {Number(r.requested_discount_percent ?? 0).toFixed(1)}%
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={STATUS_VARIANT[r.status] ?? 'outline'}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(new Date(r.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          {hasNextPage && (
            <div ref={sentinelRef} className="flex items-center justify-center py-3">
              {isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span className="text-[10px] text-muted-foreground">Role para carregar mais</span>
              )}
            </div>
          )}
        </div>
        <p className="pt-1 text-center text-[10px] text-muted-foreground">
          Exibindo {filtered.length} de {all.length} carregado(s){hasNextPage ? '+' : ''}.
        </p>
      </CardContent>
    </Card>
  );
}
