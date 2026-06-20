/**
 * useQuotes — Hook de orçamentos (Refatorado para usar React Query e quoteService)
 */
import { useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSalesScope } from '@/lib/auth/visibility-scope';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quoteService } from '@/services/quoteService';
import type { Quote, QuoteItem } from '@/hooks/quotes/quoteTypes';
import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
export type {
  Quote,
  QuoteItem,
  QuoteItemPersonalization,
  PersonalizationTechnique,
} from '@/hooks/quotes/quoteTypes';

type QuoteHistoryOptions = {
  fieldChanged?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
};

type QuoteSyncResponse = {
  error?: string;
  bitrix_deal_id?: string | number | null;
  success?: boolean;
};

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Erro desconhecido';
}

export function useQuotes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id || null;
  const scope = useSalesScope();
  const queryClient = useQueryClient();

  // BUG-NEW-02: Adiciona assinatura Realtime para orçamentos.
  // Garante que mudanças feitas em outras abas ou por outros usuários (em escopos compartilhados)
  // reflitam imediatamente na lista sem necessidade de refresh manual.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('quotes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          // O filtro simplificado garante que qualquer mudança no escopo do usuário invalide o cache
          filter: scope === 'self' ? `seller_id=eq.${userId}` : undefined,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['quotes'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, scope, queryClient]);

  const {
    data: quotes = [],
    isLoading,
    error,
    refetch: fetchQuotes,
  } = useQuery({
    queryKey: ['quotes', userId, scope],
    queryFn: () => {
      if (!userId) return Promise.resolve([]);
      return quoteService.fetchQuotes(userId, scope);
    },
    enabled: !!userId,
  });

  const { data: techniques = [], refetch: fetchTechniques } = useQuery({
    queryKey: ['techniques'],
    queryFn: () => quoteService.fetchTechniques(),
    enabled: !!userId,
    staleTime: 60 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: ({ quote, items }: { quote: Partial<Quote>; items: QuoteItem[] }) => {
      if (!userId) throw new Error('Usuario nao autenticado');
      return quoteService.createQuote(quote, items, userId, orgId);
    },
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Orçamento criado!', { description: `Número: ${newQuote.quote_number}` });
    },
    onError: (err: unknown) => {
      toast.error('Erro ao criar orçamento', { description: getErrorMessage(err) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      quoteId,
      quote,
      items,
    }: {
      quoteId: string;
      quote: Partial<Quote>;
      items: QuoteItem[];
    }) => quoteService.updateQuote(quoteId, quote, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Orçamento atualizado!');
    },
    onError: (err: unknown) => {
      toast.error('Erro ao atualizar orçamento', { description: getErrorMessage(err) });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ quoteId, status }: { quoteId: string; status: Quote['status'] }) =>
      quoteService.updateQuoteStatus(quoteId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Status atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (quoteId: string) => quoteService.deleteQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Orçamento excluído');
    },
    onError: () => {
      toast.error('Erro ao excluir orçamento');
    },
  });

  const fetchQuote = useCallback(async (quoteId: string) => {
    try {
      return await quoteService.fetchQuote(quoteId);
    } catch (err: unknown) {
      toast.error('Erro ao carregar orçamento', { description: getErrorMessage(err) });
      return null;
    }
  }, []);

  const createQuote = async (quote: Partial<Quote>, items: QuoteItem[]) => {
    if (!user) return null;
    return await createMutation.mutateAsync({ quote, items });
  };

  const updateQuote = async (quoteId: string, quote: Partial<Quote>, items: QuoteItem[]) => {
    if (!user) return null;
    return await updateMutation.mutateAsync({ quoteId, quote, items });
  };

  const updateQuoteStatus = async (quoteId: string, status: Quote['status']) => {
    try {
      await statusMutation.mutateAsync({ quoteId, status });
      return true;
    } catch {
      return false;
    }
  };

  const deleteQuote = async (quoteId: string) => {
    try {
      await deleteMutation.mutateAsync(quoteId);
      return true;
    } catch {
      return false;
    }
  };

  const duplicateQuote = async (quoteId: string): Promise<Quote | null> => {
    if (!user) return null;
    try {
      const original = await fetchQuote(quoteId);
      if (!original) throw new Error('Orçamento não encontrado');

      const items: QuoteItem[] =
        original.items?.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_image_url: item.product_image_url,
          quantity: item.quantity,
          unit_price: item.unit_price,
          color_name: item.color_name,
          color_hex: item.color_hex,
          notes: item.notes,
          personalizations: item.personalizations?.map((p) => ({
            technique_id: p.technique_id,
            technique_name: p.technique_name,
            colors_count: p.colors_count,
            positions_count: p.positions_count,
            area_cm2: p.area_cm2,
            width_cm: p.width_cm,
            height_cm: p.height_cm,
            setup_cost: p.setup_cost,
            unit_cost: p.unit_cost,
            total_cost: p.total_cost,
            notes: p.notes,
          })),
        })) ?? [];

      const newQuote = await createQuote(
        {
          client_id: original.client_id,
          contact_id: original.contact_id,
          client_name: original.client_name,
          client_email: original.client_email,
          client_phone: original.client_phone,
          client_company: original.client_company,
          client_cnpj: original.client_cnpj ?? undefined,
          status: 'draft',
          discount_percent: original.discount_percent,
          discount_amount: original.discount_amount,
          notes: original.notes,
          payment_terms: original.payment_terms,
          payment_method: original.payment_method,
          delivery_time: original.delivery_time,
          shipping_type: original.shipping_type,
          shipping_cost: original.shipping_cost,
          // BUG-NEW-01 FIX: preserve negotiation_markup_percent when duplicating.
          // Previously this field was omitted, causing the markup to be lost (reset
          // to 0) on every duplication. The total would diverge from the original
          // without any visible explanation, potentially sending wrong pricing to clients.
          negotiation_markup_percent: original.negotiation_markup_percent ?? 0,
          internal_notes: `Duplicado de ${original.quote_number}`,
          valid_until: original.valid_until,
        },
        items,
      );

      return newQuote;
    } catch (err: unknown) {
      toast.error('Erro ao duplicar', { description: getErrorMessage(err) });
      return null;
    }
  };

  const syncQuoteToBitrix = async (quoteId: string): Promise<boolean> => {
    const log = createClientLogger('quote.syncBitrix', { base: { quoteId } });
    try {
      const { data, error: fnError } = await supabase.functions.invoke('quote-sync', {
        body: { action: 'sync_quote', data: { quoteId } },
        headers: log.headers(),
      });
      if (fnError) throw new Error(fnError.message);
      const syncData = data as QuoteSyncResponse | null;
      if (syncData?.error) throw new Error(syncData.error);
      toast.success('Sincronizado com Bitrix!', {
        description: `Deal ID: ${syncData?.bitrix_deal_id || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      return true;
    } catch (err: unknown) {
      toast.error('Erro ao sincronizar', { description: getErrorMessage(err) });
      return false;
    }
  };

  const testWebhookConnection = async (): Promise<boolean> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('quote-sync', {
        body: { action: 'test_webhook', data: {} },
      });
      if (fnError) throw new Error(fnError.message);
      const testData = data as QuoteSyncResponse | null;
      if (testData?.success) {
        toast.success('Conexão com N8N estabelecida!');
        return true;
      }
      toast.error('Falha na conexão com N8N');
      return false;
    } catch (err: unknown) {
      toast.error('Erro ao testar webhook', { description: getErrorMessage(err) });
      return false;
    }
  };

  const logQuoteHistory = async (
    quoteId: string,
    action: string,
    description: string,
    options?: QuoteHistoryOptions,
  ) => {
    if (!user) return;
    try {
      await quoteService.logHistory(quoteId, user.id, action, description, options);
    } catch (err) {
      logger.error('Error logging history:', err);
    }
  };

  return {
    quotes,
    techniques,
    isLoading: isLoading || createMutation.isPending || updateMutation.isPending,
    error: error ? getErrorMessage(error) : null,
    fetchQuotes,
    fetchQuote,
    createQuote,
    updateQuote,
    updateQuoteStatus,
    deleteQuote,
    duplicateQuote,
    fetchTechniques,
    syncQuoteToBitrix,
    testWebhookConnection,
    logQuoteHistory,
  };
}
