/**
 * DiscountApprovalQueue — fila administrativa de solicitações de desconto pendentes.
 *
 * FIX 2026-06-18 (BUG-DAR-401 / G9): guards de autenticação completos:
 *   - useAuth: isAdmin + rolesLoaded — impede query antes do JWT estar pronto
 *   - enabled: rolesLoaded && Boolean(isAdmin)
 *   - retry: 0 / retryOnMount: false — sem flood em erro 401/403
 *   - isLoading composto: !rolesLoaded || queryLoading — UX correta durante auth
 *   - Early return silencioso quando !isAdmin pós-carregamento
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { logger } from '@/lib/logger';
import { DiscountApprovalAuditTrail } from './DiscountApprovalAuditTrail';
import { cn } from '@/lib/utils';

export function DiscountApprovalQueue() {
  const { isAdmin, rolesLoaded } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('request');
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['discount-approval-queue'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('discount_approval_requests')
        .select(
          '*, quotes:quote_id(quote_number, client_name, client_company, total, subtotal, discount_percent, negotiation_markup_percent, real_subtotal, real_discount_percent)',
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return rows || [];
    },
    enabled: rolesLoaded && Boolean(isAdmin),
    retry: 0,
    retryOnMount: false,
  });

  const isLoading = !rolesLoaded || queryLoading;

  const respond = useMutation({
    mutationFn: async ({
      id,
      quoteId,
      approved,
    }: {
      id: string;
      quoteId: string;
      approved: boolean;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('discount_approval_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          admin_id: u.user?.id ?? null,
          admin_notes: notes[id] ?? null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // BUG-045: transition quote out of pending_approval after admin decides.
      // approved → 'pending' (ready to send); rejected → 'draft' (needs discount adjustment).
      // Without this the quote is stuck in pending_approval indefinitely.
      const { error: qErr } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('quotes')
        .update({ status: approved ? 'pending' : 'draft' })
        .eq('id', quoteId);
      if (qErr) logger.warn('[DiscountApprovalQueue] quote status update failed', qErr);
    },
    onMutate: ({ id }) => setProcessingId(id),
    onSuccess: () => {
      toast.success('Resposta registrada');
      qc.invalidateQueries({ queryKey: ['discount-approval-queue'] });
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
    onSettled: () => setProcessingId(null),
  });

  // Deep-link: ao chegar com ?request=<id>, rola para o card destacado.
  useEffect(() => {
    if (!highlightedId || !data) return;
    const t = window.setTimeout(() => {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [highlightedId, data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!isAdmin) return null;

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((req) => {
        const reqTyped = req as {
          quote_id: string;
          quotes?: {
            quote_number?: string;
            client_name?: string;
            client_company?: string;
            total?: number;
            subtotal?: number;
            discount_percent?: number;
            negotiation_markup_percent?: number;
            real_subtotal?: number;
            real_discount_percent?: number;
          };
        };
        const quote = reqTyped.quotes;
        const quoteId = reqTyped.quote_id;
        const markup = Number(quote?.negotiation_markup_percent ?? 0);
        const apparent = Number(quote?.discount_percent ?? 0);
        const realPct = Number(quote?.real_discount_percent ?? req.requested_discount_percent);
        const hasMarkup = markup > 0;
        const isHighlighted = highlightedId === req.id;
        return (
          <Card
            key={req.id}
            ref={isHighlighted ? highlightedRef : undefined}
            data-testid={`discount-request-card-${req.id}`}
            className={cn(
              isHighlighted && 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/10',
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>Orçamento {quote?.quote_number ?? '—'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {hasMarkup && (
                    <Badge
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-warning"
                    >
                      Aparente {apparent.toFixed(1)}%
                    </Badge>
                  )}
                  <Badge
                    variant="destructive"
                    title={
                      hasMarkup
                        ? `Real: ${realPct.toFixed(2)}% · Aparente: ${apparent.toFixed(1)}% · Markup: +${markup.toFixed(1)}%`
                        : undefined
                    }
                  >
                    {hasMarkup ? `Real ${realPct.toFixed(1)}%` : `${realPct.toFixed(1)}%`} (limite{' '}
                    {req.max_allowed_percent}%)
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cliente: <strong>{quote?.client_name || quote?.client_company || '—'}</strong>
                {quote !== undefined && quote.total !== null && (
                  <>
                    {' '}
                    · Total: <strong>R$ {Number(quote.total).toFixed(2)}</strong>
                  </>
                )}
              </p>
              {hasMarkup && (
                <div className="space-y-0.5 rounded-md border border-warning/20 bg-warning/5 p-2 text-xs">
                  <p className="font-medium text-warning">
                    ⚠️ Margem de negociação aplicada (+{markup.toFixed(1)}%)
                  </p>
                  <p className="text-muted-foreground">
                    Cliente vê subtotal R$ {Number(quote?.subtotal ?? 0).toFixed(2)} com{' '}
                    {apparent.toFixed(1)}% off. Real: R${' '}
                    {Number(quote?.real_subtotal ?? 0).toFixed(2)} → desconto efetivo{' '}
                    <strong>{realPct.toFixed(2)}%</strong>.
                  </p>
                </div>
              )}
              {req.seller_notes && (
                <p className="rounded bg-muted/40 p-2 text-sm">📝 {req.seller_notes}</p>
              )}
              <Textarea
                placeholder="Notas (opcional)"
                value={notes[req.id] ?? ''}
                onChange={(e) => setNotes({ ...notes, [req.id]: e.target.value })}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => respond.mutate({ id: req.id, quoteId, approved: false })}
                  disabled={processingId === req.id}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Recusar
                </Button>
                <Button
                  onClick={() => respond.mutate({ id: req.id, quoteId, approved: true })}
                  disabled={processingId === req.id}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
              </div>
              <DiscountApprovalAuditTrail requestId={req.id} defaultOpen={isHighlighted} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
