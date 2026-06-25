/**
 * MyDiscountRequestsWidget — solicitações de desconto do usuário com busca,
 * filtros, infinite scroll e expansão inline mostrando:
 *  - motivo da rejeição (admin_notes) quando status = rejected
 *  - próximos passos contextuais por status
 *  - timeline completa (DiscountApprovalAuditTrail) reutilizada do admin
 *
 * Filtro explícito por seller_id = auth.uid().
 */
import { useMemo, useState, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Percent,
  ArrowRight,
  Clock,
  Loader2,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
import { DiscountApprovalAuditTrail } from '@/components/admin/DiscountApprovalAuditTrail';

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

type RequestRow = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_discount_percent: number;
  max_allowed_percent: number | null;
  quote_id: string;
  created_at: string;
  responded_at: string | null;
  admin_notes: string | null;
};

export function MyDiscountRequestsWidget() {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WidgetFiltersValue>(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['my-discount-requests-widget', userId],
    enabled: !!userId,
    // Atualização near-realtime: a tabela `discount_approval_requests` foi
    // intencionalmente removida do `supabase_realtime` (migration 20260419).
    // Para refletir approved/rejected sem refresh manual usamos polling curto
    // + refetch ao voltar a foco/janela. ~15s casa com o intervalo das
    // notifications do workspace e mantém o custo de leitura controlado.
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!userId) return [];
      let q = supabase
        .from('discount_approval_requests')
        .select(
          'id, status, requested_discount_percent, max_allowed_percent, quote_id, created_at, responded_at, admin_notes',
        )
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data: queryRows, error } = await q;
      if (error) throw error;
      return (queryRows ?? []) as RequestRow[];
    },
    getNextPageParam: (last) =>
      last.length < PAGE_SIZE ? undefined : (last[last.length - 1]?.created_at ?? undefined),
  });

  const all = useMemo<RequestRow[]>(() => data?.pages.flat() ?? [], [data]);

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
    <Card data-testid="my-discount-requests-widget">
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
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhuma solicitação encontrada com os filtros atuais.
            </p>
          ) : (
            filtered.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <div
                  key={r.id}
                  data-testid={`discount-request-row-${r.id}`}
                  data-status={r.status}
                  className="rounded-lg border border-border/30 bg-card/30"
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-secondary/50"
                    data-testid={`discount-request-toggle-${r.id}`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Percent className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        Desconto solicitado:{' '}
                        {Number(r.requested_discount_percent ?? 0).toFixed(1)}%
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
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div
                      className="space-y-3 border-t border-border/40 p-3"
                      data-testid={`discount-request-expanded-${r.id}`}
                    >
                      {/* Motivo da rejeição (destaque) */}
                      {r.status === 'rejected' && (
                        <div
                          data-testid={`discount-request-rejection-${r.id}`}
                          className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          <div className="space-y-1">
                            <p className="font-semibold text-destructive">Motivo da rejeição</p>
                            <p className="whitespace-pre-wrap text-foreground">
                              {r.admin_notes?.trim()
                                ? r.admin_notes
                                : 'O gestor não registrou um motivo específico. Entre em contato para mais detalhes.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Próximos passos */}
                      <NextSteps row={r} onOpenQuote={() => navigate(`/orcamentos/${r.quote_id}`)} />

                      {/* Timeline completa */}
                      <DiscountApprovalAuditTrail requestId={r.id} defaultOpen />
                    </div>
                  )}
                </div>
              );
            })
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

function NextSteps({ row, onOpenQuote }: { row: RequestRow; onOpenQuote: () => void }) {
  const limit = row.max_allowed_percent != null ? Number(row.max_allowed_percent) : null;

  if (row.status === 'pending') {
    return (
      <div
        data-testid={`discount-request-next-steps-${row.id}`}
        data-next-steps="pending"
        className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
      >
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-700 dark:text-amber-400">Aguardando aprovação</p>
          <p className="text-foreground">
            Sua solicitação está na fila do gestor comercial. Você será notificado assim que houver
            uma decisão.
          </p>
        </div>
      </div>
    );
  }

  if (row.status === 'approved') {
    return (
      <div
        data-testid={`discount-request-next-steps-${row.id}`}
        data-next-steps="approved"
        className="flex gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div className="flex-1 space-y-2">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">Desconto aprovado</p>
          <p className="text-foreground">
            O orçamento está liberado para envio ao cliente.
          </p>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onOpenQuote}>
            Abrir orçamento
          </Button>
        </div>
      </div>
    );
  }

  // rejected
  return (
    <div
      data-testid={`discount-request-next-steps-${row.id}`}
      data-next-steps="rejected"
      className="flex gap-2 rounded-md border border-border/40 bg-muted/30 p-3 text-xs"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 space-y-2">
        <p className="font-semibold text-foreground">Próximos passos</p>
        <ul className="list-disc space-y-1 pl-4 text-foreground">
          <li>
            Reduza o desconto para no máximo{' '}
            <strong>{limit != null ? `${limit.toFixed(2)}%` : 'o seu limite atual'}</strong> e
            reenvie ao cliente sem nova aprovação.
          </li>
          <li>
            Ou ajuste a justificativa (volume, prazo, fidelidade) e envie uma nova solicitação ao
            gestor.
          </li>
          <li>Em caso de dúvida, alinhe verbalmente com o gestor antes de reenviar.</li>
        </ul>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onOpenQuote}>
          Abrir orçamento para ajustar
        </Button>
      </div>
    </div>
  );
}
