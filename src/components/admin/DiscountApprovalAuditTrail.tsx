/**
 * DiscountApprovalAuditTrail — histórico cronológico de uma solicitação de
 * aprovação de desconto. Lê `discount_approval_audit` (gerada por trigger
 * `trg_audit_discount_approval`).
 *
 * Renderizado dentro de cada card da `DiscountApprovalQueue`. Lazy: só busca
 * quando o usuário expande o accordion (evita N+1 inicial na fila).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Clock, XCircle, AlertTriangle, History, FileDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportDiscountAuditPdf } from '@/lib/quotes/exportDiscountAuditPdf';


interface AuditRow {
  id: string;
  event: 'requested' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'superseded';
  actor_role: 'seller' | 'admin' | 'supervisor' | 'system';
  actor_id: string | null;
  requested_discount_percent: number | null;
  max_allowed_percent: number | null;
  real_discount_percent: number | null;
  admin_notes: string | null;
  seller_notes: string | null;
  created_at: string;
  actor?: { full_name: string | null; email: string | null } | null;
}

const EVENT_META: Record<
  AuditRow['event'],
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  requested: { label: 'Solicitado pelo vendedor', icon: Clock, tone: 'text-amber-500' },
  approved: { label: 'Aprovado', icon: CheckCircle2, tone: 'text-emerald-500' },
  rejected: { label: 'Rejeitado', icon: XCircle, tone: 'text-destructive' },
  expired: { label: 'Expirado', icon: AlertTriangle, tone: 'text-muted-foreground' },
  cancelled: { label: 'Cancelado', icon: XCircle, tone: 'text-muted-foreground' },
  superseded: { label: 'Substituído', icon: History, tone: 'text-muted-foreground' },
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatPct(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(2).replace('.', ',')}%`;
}

interface Props {
  requestId: string;
  defaultOpen?: boolean;
}

export function DiscountApprovalAuditTrail({ requestId, defaultOpen = false }: Props) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['discount-approval-audit', requestId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        // rls-allow: SELECT permitido a admin/supervisor/seller dono via policy daa_select_scope
        .from('discount_approval_audit')
        .select(
          'id, event, actor_role, actor_id, requested_discount_percent, max_allowed_percent, real_discount_percent, admin_notes, seller_notes, created_at, actor:actor_id(full_name, email)',
        )
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (rows ?? []) as unknown as AuditRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo<AuditRow[]>(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((r) => {
      const actor = `${r.actor?.full_name ?? ''} ${r.actor?.email ?? ''}`.toLowerCase();
      const meta = EVENT_META[r.event]?.label.toLowerCase() ?? '';
      const notes = `${r.admin_notes ?? ''} ${r.seller_notes ?? ''}`.toLowerCase();
      return (
        actor.includes(q) ||
        meta.includes(q) ||
        notes.includes(q) ||
        r.event.includes(q) ||
        r.actor_role.toLowerCase().includes(q)
      );
    });
  }, [data, search]);


  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? 'audit' : undefined}
      className="rounded-md border border-border/30 bg-muted/20"
    >
      <AccordionItem value="audit" className="border-0">
        <AccordionTrigger
          data-testid={`discount-audit-toggle-${requestId}`}
          className="px-3 py-2 text-xs font-medium hover:no-underline"
        >
          <span className="flex items-center gap-2">
            <History className="h-3.5 w-3.5" />
            Histórico de decisões
            {data && data.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                {data.length}
              </Badge>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          {data && data.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por decisor, evento ou motivo…"
                  className="h-7 pl-7 text-[11px]"
                  data-testid={`discount-audit-search-${requestId}`}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-[11px]"
                data-testid={`discount-audit-export-pdf-${requestId}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await exportDiscountAuditPdf({
                      requestId,
                      rows: data.map((r) => ({
                        event: r.event,
                        actor_role: r.actor_role,
                        actor_name: r.actor?.full_name ?? null,
                        actor_email: r.actor?.email ?? null,
                        requested_discount_percent: r.requested_discount_percent,
                        max_allowed_percent: r.max_allowed_percent,
                        real_discount_percent: r.real_discount_percent,
                        admin_notes: r.admin_notes,
                        seller_notes: r.seller_notes,
                        created_at: r.created_at,
                      })),
                    });
                    toast.success('PDF gerado');
                  } catch {
                    toast.error('Não foi possível gerar o PDF');
                  }
                }}
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : filtered.length === 0 ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid={`discount-audit-empty-search-${requestId}`}
            >
              Nenhum evento corresponde a "{search}".
            </p>
          ) : (
            <ol className="space-y-2" data-testid={`discount-audit-list-${requestId}`}>
              {filtered.map((row) => {
                const meta = EVENT_META[row.event];
                const Icon = meta.icon;
                const actorName = row.actor?.full_name || row.actor?.email || 'Sistema';
                return (
                  <li
                    key={row.id}
                    data-testid={`discount-audit-item-${row.id}`}
                    data-event={row.event}
                    className="flex gap-2.5 rounded border border-border/40 bg-card/40 p-2.5 text-xs"
                  >
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.tone)} />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={cn('font-semibold', meta.tone)}>{meta.label}</span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {row.actor_role}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {formatDateTime(row.created_at)}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">{actorName}</strong> —{' '}
                        solicitado {formatPct(row.requested_discount_percent)} · limite{' '}
                        {formatPct(row.max_allowed_percent)}
                        {row.real_discount_percent !== null && (
                          <> · real {formatPct(row.real_discount_percent)}</>
                        )}
                      </p>
                      {row.seller_notes && row.event === 'requested' && (
                        <p className="rounded bg-amber-500/10 p-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                          📝 {row.seller_notes}
                        </p>
                      )}
                      {row.admin_notes && row.event !== 'requested' && (
                        <p className="rounded bg-muted/40 p-1.5 text-[11px]">
                          💬 {row.admin_notes}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
