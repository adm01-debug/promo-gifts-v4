/**
 * useDiscountApproval — Gerencia solicitações de aprovação de desconto
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logRlsDenial } from '@/lib/security/rls-denial-logger';

import { logger } from '@/lib/logger';
export interface DiscountApprovalRequest {
  id: string;
  quote_id: string;
  seller_id: string;
  requested_discount_percent: number;
  max_allowed_percent: number;
  status: 'approved' | 'pending' | 'rejected';
  admin_id: string | null;
  admin_notes: string | null;
  seller_notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscountApprovalWithQuote extends DiscountApprovalRequest {
  quote?: {
    quote_number: string;
    client_name: string | null;
    client_company: string | null;
    total: number;
    subtotal: number;
  };
  seller?: {
    full_name: string | null;
    email: string | null;
  };
}

/**
 * Cache module-level de chamadas in-flight por (quote_id, requested_pct, max_pct).
 * Garante idempotência local a uma aba mesmo sob double-click acelerado, ANTES
 * de bater na rede. Cross-tab/cross-device é coberto pelo índice único parcial
 * `uniq_dar_quote_pending` no banco (SQLSTATE 23505 → tratado como sucesso).
 */
const inflightApprovals = new Map<string, Promise<boolean>>();
const idempotencyKey = (q: string, req: number, max: number): string =>
  `${q}::${Number(req).toFixed(4)}::${Number(max).toFixed(4)}`;

export function useDiscountApproval() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingRequests, setPendingRequests] = useState<DiscountApprovalWithQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Invalida o widget do vendedor (todas as sessões com a chave parcial)
  // imediatamente após qualquer mudança em discount_approval_requests —
  // não depende de realtime/polling para o badge ficar fresco.
  const invalidateWidget = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['my-discount-requests-widget'],
      refetchType: 'active',
    });
  }, [queryClient]);

  // Request approval (seller action)
  const requestApproval = useCallback(
    async (
      quoteId: string,
      requestedPercent: number,
      maxAllowedPercent: number,
      sellerNotes?: string,
    ): Promise<boolean> => {
      if (!user) return false;
      // In-flight dedup: chamada concorrente com mesma chave retorna a mesma Promise.
      const key = idempotencyKey(quoteId, requestedPercent, maxAllowedPercent);
      const existing = inflightApprovals.get(key);
      if (existing) {
        logger.info('Idempotent: returning in-flight approval promise for key', { key });
        return existing;
      }
      const promise = (async (): Promise<boolean> => {
      try {
        // BUG-040: Dedup guard — idempotent under double-clicks / retries.
        // A pending row for this quote already satisfies the intent; skip the
        // duplicate INSERT to avoid confusing the admin approval queue.
        // BUG-APPROVAL-DEDUP-SILENT-FAIL FIX: previously { error } was not destructured.
        // An RLS denial or network error returned { data: null, error } but the error
        // was silently swallowed — existing stayed null and we always proceeded to INSERT,
        // defeating the dedup guard and flooding the admin approval queue.
        // Dedup: 1 pending por (quote_id, requested_pct, max_pct). Mesmo clique
        // duplicado / retry de rede → curto-circuito idempotente. Pending com
        // percentuais DIFERENTES ainda é tratado como sucesso (o índice único
        // parcial `uniq_dar_quote_pending` impede o segundo INSERT de qualquer
        // forma), apenas com warn explícito para diagnóstico.
        const { data: existing, error: dupCheckErr } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .select('id, requested_discount_percent, max_allowed_percent')
          .eq('quote_id', quoteId)
          .eq('status', 'pending')
          .maybeSingle();
        if (dupCheckErr) logger.warn('Dedup check failed, proceeding with INSERT:', dupCheckErr);
        if (existing) {
          const samePct =
            Number(existing.requested_discount_percent) === Number(requestedPercent) &&
            Number(existing.max_allowed_percent) === Number(maxAllowedPercent);
          if (samePct) {
            logger.info('Idempotent: pending approval already exists with identical pcts; skipping INSERT');
            toast.success('Solicitação de aprovação enviada ao admin!');
          } else {
            logger.warn(
              'Pending approval exists with different pcts; skipping INSERT to avoid 23505 on uniq_dar_quote_pending',
              { existingPct: existing.requested_discount_percent, newPct: requestedPercent },
            );
            toast.warning(
              'Já existe uma solicitação pendente para este orçamento com percentuais diferentes. ' +
                'Aguarde a decisão do gestor ou ajuste para os mesmos valores.',
              { duration: 8000 },
            );
          }
          invalidateWidget();
          return true;
        }

        const { data: inserted, error } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .insert({
            quote_id: quoteId,
            seller_id: user.id,
            requested_discount_percent: requestedPercent,
            max_allowed_percent: maxAllowedPercent,
            seller_notes: sellerNotes || null,
          })
          .select('id')
          .maybeSingle();
        if (error) {
          // Idempotência DB: índice único parcial `uniq_dar_quote_pending`
          // garante 1 pending por quote_id. SQLSTATE 23505 sob corrida → trata
          // como sucesso (já existe a solicitação pendente que queríamos criar).
          const code = (error as { code?: string }).code;
          if (code === '23505') {
            logger.warn('Duplicate pending approval intercepted by unique index; treating as idempotent success');
            toast.success('Solicitação de aprovação enviada ao admin!');
            return true;
          }
          await logRlsDenial(error, {
            table: 'discount_approval_requests',
            op: 'INSERT',
            endpoint: 'useDiscountApproval.requestApproval',
            targetId: quoteId,
            targetSellerId: user.id,
            policyHint: 'dar_insert_scope',
            querySummary: `requestedPct=${requestedPercent}`,
          });
          throw error;
        }
        const newRequestId = inserted?.id ?? null;


        // Set quote status to pending_approval so UI shows correct state.
        // IMPORTANT: throw on failure — a swallowed error here would leave an
        // orphaned approval request row while the quote stays editable, allowing
        // the seller to overwrite the discount under admin review.
        const { error: statusError } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('quotes')
          .update({ status: 'pending_approval' })
          .eq('id', quoteId);
        if (statusError) {
          logger.error('Failed to set quote status to pending_approval:', statusError);
          throw statusError;
        }

        // Buscar contexto do orçamento (markup + aparente) para auditoria e história
        // BUG-DISCOUNTAPPROVAL-QUOTECTX-SELECT-SILENT-FAIL FIX: { data: quoteCtx } without
        // error check — RLS failure silently produced null ctx, markup logged as 0 in audit.
        // Secondary fetch: primary update already succeeded; log.warn and degrade gracefully.
        const { data: quoteCtx, error: quoteCtxErr } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('quotes')
          .select('discount_percent, negotiation_markup_percent, real_discount_percent')
          .eq('id', quoteId)
          .maybeSingle();
        if (quoteCtxErr) logger.warn('Failed to fetch quote context for audit trail:', quoteCtxErr);
        const markup = Number(quoteCtx?.negotiation_markup_percent ?? 0);
        const apparent = Number(quoteCtx?.discount_percent ?? 0);

        // Log in quote history (incluindo flag de markup)
        // BUG-SILENT-INSERT FIX: Supabase doesn't throw on failed mutations — it
        // returns the error in the response. Await without destructuring meant any
        // RLS denial or constraint violation was silently ignored, leaving gaps in
        // the audit trail. These are non-critical secondary ops so we log but don't throw.
        const { error: historyErr } = await supabase.from('quote_history').insert({
          quote_id: quoteId,
          user_id: user.id,
          action: 'discount_approval_requested',
          description:
            markup > 0
              ? `Solicitação de desconto REAL ${requestedPercent.toFixed(2)}% (aparente ${apparent.toFixed(1)}% com markup +${markup.toFixed(1)}%, limite ${maxAllowedPercent}%)`
              : `Solicitação de desconto de ${requestedPercent}% (limite: ${maxAllowedPercent}%)`,
          field_changed: 'discount',
          new_value: `${requestedPercent}%`,
          metadata: {
            seller_notes: sellerNotes || null,
            apparent_discount_percent: apparent,
            real_discount_percent: requestedPercent,
            negotiation_markup_percent: markup,
          },
        });
        if (historyErr) logger.error('Failed to log quote history:', historyErr);

        // Audit trail dedicado quando há markup (visibilidade admin)
        if (markup > 0) {
          const { error: auditErr } = await supabase.from('admin_audit_log').insert({
            user_id: user.id,
            action: 'quote_negotiation_markup_applied',
            resource_type: 'quote',
            resource_id: quoteId,
            details: {
              negotiation_markup_percent: markup,
              apparent_discount_percent: apparent,
              real_discount_percent: requestedPercent,
              max_allowed_percent: maxAllowedPercent,
              context: 'discount_approval_request',
            },
          });
          if (auditErr) logger.error('Failed to log audit trail:', auditErr);
        }

        // Notify all admins — both queries are independent, run in parallel
        // BUG-NOTIFY-ADMIN-SILENT-FAIL FIX: previously { error } was not destructured from
        // the user_roles query. If the query failed (RLS denial, network error), adminRoles
        // was null, the `if (adminRoles && ...)` guard silently skipped notification, and
        // nothing was logged — admins never knew a discount approval had been requested.
        const [{ data: adminRoles, error: rolesErr }, { data: profile }] = await Promise.all([
          supabase.from('user_roles').select('user_id').eq('role', 'admin'),
          supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
        ]);
        if (rolesErr) logger.warn('Failed to fetch admin roles for discount notification:', rolesErr);
        if (adminRoles && adminRoles.length > 0) {
          const sellerName = profile?.full_name || 'Vendedor';
          const msg =
            markup > 0
              ? `${sellerName} solicitou desconto real de ${requestedPercent.toFixed(2)}% (aparente ${apparent.toFixed(1)}% com markup +${markup.toFixed(1)}%, limite ${maxAllowedPercent}%)`
              : `${sellerName} solicitou ${requestedPercent.toFixed(1)}% de desconto (limite: ${maxAllowedPercent}%)`;
          const deepLink = newRequestId
            ? `/admin/usuarios?tab=discounts&request=${newRequestId}`
            : '/admin/usuarios?tab=discounts';
          const { error: notifyErr } = await supabase.from('workspace_notifications').insert(
            adminRoles.map((a) => ({
              user_id: a.user_id,
              title: 'Solicitação de desconto',
              message: msg,
              type: 'warning',
              category: 'discount',
              action_url: deepLink,
              metadata: {
                request_id: newRequestId,
                quote_id: quoteId,
                seller_id: user.id,
                seller_name: sellerName,
                requested_discount_percent: requestedPercent,
                max_allowed_percent: maxAllowedPercent,
                real_discount_percent: requestedPercent,
                apparent_discount_percent: apparent,
                negotiation_markup_percent: markup,
                seller_notes: sellerNotes || null,
              },
            })),
          );

          if (notifyErr) logger.error('Failed to notify admins of approval request:', notifyErr);
        }

        toast.success('Solicitação de aprovação enviada ao admin!');
        return true;
      } catch (err) {
        logger.error('Error requesting approval:', err);
        // Mensagens específicas por tipo de erro com ação sugerida.
        const e = err as { code?: string; status?: number; message?: string; name?: string };
        const status = Number(e?.status ?? 0);
        const code = String(e?.code ?? '');
        const msg = String(e?.message ?? '');
        const isTimeout =
          e?.name === 'AbortError' ||
          /timeout|timed out|fetch failed|network/i.test(msg);
        if (code === '23505' || status === 409) {
          toast.warning(
            'Já existe uma solicitação pendente para este orçamento. Verifique o widget "Minhas Solicitações" antes de tentar novamente.',
            { duration: 8000 },
          );
        } else if (isTimeout) {
          toast.error(
            'Tempo esgotado ao enviar a solicitação. Verifique sua conexão e tente novamente.',
            {
              duration: 8000,
              action: { label: 'Tentar novamente', onClick: () => void 0 },
            },
          );
        } else if (status >= 500) {
          toast.error(
            'Falha temporária do servidor (5xx). Aguarde alguns segundos e tente novamente.',
            { duration: 8000 },
          );
        } else {
          toast.error('Erro ao solicitar aprovação. Tente novamente em instantes.');
        }
        return false;
      }
      })();
      inflightApprovals.set(key, promise);
      try {
        return await promise;
      } finally {
        // Libera a chave assim que a Promise resolve (sucesso OU falha),
        // permitindo retry intencional do usuário sem ficar travado.
        inflightApprovals.delete(key);
      }
    },
    [user],
  );

  // Respond to approval (admin action)
  const respondToApproval = useCallback(
    async (requestId: string, approved: boolean, adminNotes?: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const validUntilDate = approved
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const { data: request, error: updateError } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .update({
            status: approved ? 'approved' : 'rejected',
            admin_id: user.id,
            admin_notes: adminNotes || null,
            responded_at: new Date().toISOString(),
            valid_until: validUntilDate,
          })
          .eq('id', requestId)
          .select()
          .single();
        if (updateError) {
          await logRlsDenial(updateError, {
            table: 'discount_approval_requests',
            op: 'UPDATE',
            endpoint: 'useDiscountApproval.respondToApproval',
            targetId: requestId,
            policyHint: 'dar_update_scope',
            querySummary: `decision=${approved ? 'approved' : 'rejected'}`,
          });
          throw updateError;
        }

        const typedReq = request as DiscountApprovalRequest;

        // Update quote status: approved → pending (ready to send), rejected → draft (needs adjustment)
        const newStatus = approved ? 'pending' : 'draft';
        const [quoteUpdateResult, historyResult] = await Promise.all([
          supabase
            // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
            .from('quotes')
            .update({ status: newStatus })
            .eq('id', typedReq.quote_id),
          // Log in quote history for auditability
          supabase.from('quote_history').insert({
            quote_id: typedReq.quote_id,
            user_id: user.id,
            action: approved ? 'discount_approved' : 'discount_rejected',
            description: approved
              ? `Desconto de ${typedReq.requested_discount_percent}% aprovado pelo admin`
              : `Desconto de ${typedReq.requested_discount_percent}% rejeitado pelo admin`,
            field_changed: 'discount',
            old_value: `${typedReq.max_allowed_percent}%`,
            new_value: `${typedReq.requested_discount_percent}%`,
            metadata: {
              admin_notes: adminNotes || null,
              status: approved ? 'approved' : 'rejected',
            },
          }),
        ]);

        if (quoteUpdateResult.error) {
          logger.error('Failed to update quote status:', quoteUpdateResult.error);
        }
        if (historyResult.error) {
          logger.error('Failed to log quote history:', historyResult.error);
        }

        // Notify the seller
        // BUG-NOTIFY-SELLER-SILENT-FAIL FIX: previously a bare `await supabase...` was used
        // here — Supabase JS v2 never throws on DB errors, so any RLS denial or constraint
        // violation was silently swallowed. The seller would never receive the decision
        // notification and nothing was logged. Destructure { error } and log on failure.
        const { error: sellerNotifyErr } = await supabase.from('workspace_notifications').insert({
          user_id: typedReq.seller_id,
          title: approved ? 'Desconto aprovado ✅' : 'Desconto rejeitado ❌',
          message: approved
            ? `Seu desconto de ${typedReq.requested_discount_percent}% foi aprovado. O orçamento está pronto para envio.`
            : `Seu desconto de ${typedReq.requested_discount_percent}% foi rejeitado.${adminNotes ? ` Motivo: ${adminNotes}` : ' Ajuste o desconto e tente novamente.'}`,
          type: approved ? 'success' : 'error',
          category: 'discount',
          action_url: `/orcamentos/${typedReq.quote_id}`,
        });
        if (sellerNotifyErr)
          logger.error('Failed to notify seller of approval decision:', sellerNotifyErr);

        toast.success(approved ? 'Desconto aprovado!' : 'Desconto rejeitado');
        return true;
      } catch (err) {
        logger.error('Error responding to approval:', err);
        toast.error('Erro ao responder solicitação');
        return false;
      }
    },
    [user],
  );

  // Fetch pending requests (admin)
  const fetchPendingRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
        .from('discount_approval_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        await logRlsDenial(error, {
          table: 'discount_approval_requests',
          op: 'SELECT',
          endpoint: 'useDiscountApproval.fetchPendingRequests',
          policyHint: 'dar_select_scope',
        });
        throw error;
      }
      const requests = (data || []) as DiscountApprovalRequest[];

      if (requests.length === 0) {
        setPendingRequests([]);
        return;
      }

      // Batch fetch quotes and sellers in parallel (no N+1)
      const quoteIds = [...new Set(requests.map((r) => r.quote_id))];
      const sellerIds = [...new Set(requests.map((r) => r.seller_id))];

      const [quotesRes, sellersRes] = await Promise.all([
        supabase
          .from('quotes') // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .select('id, quote_number, client_name, client_company, total, subtotal')
          .in('id', quoteIds),
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', sellerIds),
      ]);

      const quotesMap = new Map(
        (quotesRes.data || []).map((q) => [
          q.id,
          { ...q, total: q.total ?? 0, subtotal: q.subtotal ?? 0 },
        ]),
      );
      const sellersMap = new Map((sellersRes.data || []).map((s) => [s.user_id, s]));

      const enriched: DiscountApprovalWithQuote[] = requests.map((req) => ({
        ...req,
        quote: quotesMap.get(req.quote_id) || undefined,
        seller: sellersMap.get(req.seller_id) || undefined,
      }));

      setPendingRequests(enriched);
    } catch (err) {
      logger.error('Error fetching approval requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get approval status for a specific quote
  const getApprovalStatus = useCallback(
    async (quoteId: string): Promise<DiscountApprovalRequest | null> => {
      try {
        // BUG-APPROVAL-STATUS-SILENT-FAIL FIX: previously { error } was not destructured.
        // Any RLS denial or network failure returned { data: null, error } silently —
        // callers saw null and treated it as "no approval request exists", which could
        // allow the discount flow to bypass the pending_approval gate.
        const { data, error } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) logger.error('Error fetching approval status:', error);
        return (data as DiscountApprovalRequest) || null;
      } catch (err) {
        logger.error('Unexpected error in getApprovalStatus:', err);
        return null;
      }
    },
    [],
  );

  return {
    pendingRequests,
    isLoading,
    requestApproval,
    respondToApproval,
    fetchPendingRequests,
    getApprovalStatus,
  };
}
