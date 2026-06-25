/**
 * DiscountRequestDetailPage — timeline detalhada de uma única solicitação
 * de aprovação de desconto. Rota: `/admin/aprovacoes-desconto/:id`.
 *
 * Reaproveita `DiscountApprovalAuditTrail` (já cobre timeline + export PDF)
 * e expõe os atalhos rápidos de aprovar/rejeitar quando o request ainda
 * está pending. Para listagem + filtros, ver `DiscountApprovalQueue`.
 */
import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { DiscountApprovalAuditTrail } from '@/components/admin/DiscountApprovalAuditTrail';

interface RequestRow {
  id: string;
  quote_id: string;
  seller_id: string;
  requested_discount_percent: number;
  max_allowed_percent: number;
  seller_notes: string | null;
  admin_notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  responded_at: string | null;
  quotes?: {
    quote_number?: string | null;
    client_name?: string | null;
    client_company?: string | null;
    total?: number | null;
    real_discount_percent?: number | null;
  } | null;
  seller?: { full_name?: string | null; email?: string | null } | null;
}

const STATUS_LABEL: Record<RequestRow['status'], { label: string; variant: 'default' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
};

export default function DiscountRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, rolesLoaded } = useAuth();
  const qc = useQueryClient();
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['discount-approval-detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data: row, error } = await supabase
        // rls-allow: admin via has_role; RLS filtra
        .from('discount_approval_requests')
        .select(
          '*, quotes:quote_id(quote_number, client_name, client_company, total, real_discount_percent), seller:seller_id(full_name, email)',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return row as RequestRow | null;
    },
    enabled: Boolean(id) && rolesLoaded && Boolean(isAdmin),
  });

  const respond = useMutation({
    mutationFn: async (approved: boolean) => {
      if (!id || !data) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('discount_approval_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          admin_id: u.user?.id ?? null,
          admin_notes: adminNotes || null,
          responded_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await supabase
        .from('quotes')
        .update({ status: approved ? 'pending' : 'draft' })
        .eq('id', data.quote_id);
    },
    onSuccess: () => {
      toast.success('Decisão registrada');
      qc.invalidateQueries({ queryKey: ['discount-approval-detail', id] });
      qc.invalidateQueries({ queryKey: ['discount-approval-queue'] });
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  const sellerLabel = useMemo(
    () => data?.seller?.full_name || data?.seller?.email || data?.seller_id?.slice(0, 8) || '—',
    [data],
  );

  if (!rolesLoaded || isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-3 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="container mx-auto max-w-3xl p-6"
        data-testid="app-access-denied"
        data-status="forbidden"
      >
        <p className="text-sm text-muted-foreground">Acesso restrito ao gestor comercial.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="container mx-auto max-w-3xl p-6"
        data-testid="discount-request-not-found"
        data-status="not-found"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          data-testid="discount-request-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <p
          className="mt-4 text-sm text-muted-foreground"
          data-testid="discount-request-not-found-message"
        >
          Solicitação não encontrada.
        </p>
      </div>
    );
  }

  const status = STATUS_LABEL[data.status];

  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6" data-testid="discount-request-detail">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/usuarios?tab=discounts')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Fila de aprovações
        </Button>
        <Badge variant={status.variant} data-testid="discount-request-status" data-status={data.status}>
          {status.label}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
            <span>Orçamento {data.quotes?.quote_number ?? '—'}</span>
            <Link
              to={`/orcamentos/${data.quote_id}`}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Abrir orçamento <ExternalLink className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Vendedor" value={sellerLabel} />
            <Metric label="Cliente" value={data.quotes?.client_name || data.quotes?.client_company || '—'} />
            <Metric
              label="Solicitado"
              value={`${Number(data.requested_discount_percent).toFixed(2)}%`}
            />
            <Metric
              label="Limite do vendedor"
              value={`${Number(data.max_allowed_percent).toFixed(2)}%`}
            />
          </div>
          {data.seller_notes && (
            <div className="rounded bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Justificativa do vendedor</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{data.seller_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {data.status === 'pending' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Decisão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Notas para o vendedor (opcional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              data-testid="discount-request-admin-notes"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={() => respond.mutate(false)}
                disabled={respond.isPending}
                data-testid="discount-request-reject"
              >
                <XCircle className="mr-2 h-4 w-4" /> Rejeitar
              </Button>
              <Button
                onClick={() => respond.mutate(true)}
                disabled={respond.isPending}
                data-testid="discount-request-approve"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Linha do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountApprovalAuditTrail requestId={data.id} defaultOpen />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
