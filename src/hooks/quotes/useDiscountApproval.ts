/**
 * useDiscountApproval — Gerencia solicitações de aprovação de desconto
 */
import { useState, useCallback } from 'react';
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
  status: 'pending' | 'approved' | 'rejected';
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

export function useDiscountApproval() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<DiscountApprovalWithQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Request approval (seller action)
  const requestApproval = useCallback(
    async (
      quoteId: string,
      requestedPercent: number,
      maxAllowedPercent: number,
      sellerNotes?: string,
    ): Promise<boolean> => {
      if (!user) return false;
      try {
        const { error } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .insert({
            quote_id: quoteId,
            seller_id: user.id,
            requested_discount_percent: requestedPercent,
            max_allowed_percent: maxAllowedPercent,
            seller_notes: sellerNotes || null,
          });
        if (error) {
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
        const { data: quoteCtx } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('quotes')
          .select('discount_percent, negotiation_markup_percent, real_discount_percent')
          .eq('id', quoteId)
          .maybeSingle();
        const markup = Number(quoteCtx?.negotiation_markup_percent ?? 0);
        const apparent = Number(quoteCtx?.discount_percent ?? 0);

        // Log in quote history (incluindo flag de markup)
        await supabase.from('quote_history').insert({
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

        // Audit trail dedicado quando há markup (visibilidade admin)
        if (markup > 0) {
          await supabase.from('admin_audit_log').insert({
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
        }

        // Notify all admins — both queries are independent, run in parallel
        const [{ data: adminRoles }, { data: profile }] = await Promise.all([
          supabase.from('user_roles').select('user_id').eq('role', 'admin'),
          supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
        ]);
        if (adminRoles && adminRoles.length > 0) {
          const sellerName = profile?.full_name || 'Vendedor';
          const msg =
            markup > 0
              ? `${sellerName} solicitou desconto real de ${requestedPercent.toFixed(2)}% (aparente ${apparent.toFixed(1)}% com markup +${markup.toFixed(1)}%, limite ${maxAllowedPercent}%)`
              : `${sellerName} solicitou ${requestedPercent.toFixed(1)}% de desconto (limite: ${maxAllowedPercent}%)`;
          await supabase.from('workspace_notifications').insert(
            adminRoles.map((a) => ({
              user_id: a.user_id,
              title: 'Solicitação de desconto',
              message: msg,
              type: 'warning',
              category: 'discount',
              action_url: '/admin/usuarios?tab=discounts',
            })),
          );
        }

        toast.success('Solicitação de aprovação enviada ao admin!');
        return true;
      } catch (err) {
        logger.error('Error requesting approval:', err);
        toast.error('Erro ao solicitar aprovação');
        return false;
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
        await supabase.from('workspace_notifications').insert({
          user_id: typedReq.seller_id,
          title: approved ? 'Desconto aprovado ✅' : 'Desconto rejeitado ❌',
          message: approved
            ? `Seu desconto de ${typedReq.requested_discount_percent}% foi aprovado. O orçamento está pronto para envio.`
            : `Seu desconto de ${typedReq.requested_discount_percent}% foi rejeitado.${adminNotes ? ` Motivo: ${adminNotes}` : ' Ajuste o desconto e tente novamente.'}`,
          type: approved ? 'success' : 'error',
          category: 'discount',
          action_url: `/orcamentos/${typedReq.quote_id}`,
        });

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
        const { data } = await supabase
          // rls-allow: fluxo de aprovação admin/seller; RLS filtra por papel
          .from('discount_approval_requests')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return (data as DiscountApprovalRequest) || null;
      } catch {
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
