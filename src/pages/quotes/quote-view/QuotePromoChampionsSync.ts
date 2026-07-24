/**
 * Promo Champions sync — dispara evento `quote.sent` via webhook-dispatcher.
 * Reaproveita a infra do outbound_webhooks (registro em /admin/conexoes).
 * Idempotência é garantida pelo próprio dispatcher via correlation key do payload.
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Quote } from '@/hooks/quotes';
import { invokeEdge } from '@/lib/edge/safeInvokeCall';

interface SyncPromoChampionsParams {
  quote: Quote;
  userEmail?: string;
  logQuoteHistory: (
    quoteId: string,
    action: string,
    description: string,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
}

export async function syncQuoteToPromoChampions({
  quote,
  userEmail,
  logQuoteHistory,
}: SyncPromoChampionsParams): Promise<{ success: boolean }> {
  if (!quote.id) {
    toast.error('Orçamento sem identificador válido');
    return { success: false };
  }
  const quoteId = quote.id;

  logQuoteHistory(quoteId, 'sync_started', 'Sincronização com Promo Champions iniciada').catch(
    (err) => {
      logger.warn('logQuoteHistory(sync_started PC) failed', { err, quoteId });
    },
  );

  // Evento canônico `quote.sent` — o dispatcher fanout para todos os webhooks
  // registrados que assinam esse evento (Promo Champions inclui-se aí).
  // `correlation_key` no payload garante dedupe no destino.
  const correlationKey = `quote:${quoteId}:sent:${quote.updated_at ?? ''}`;

  const { data, error } = await invokeEdge<{ ok?: boolean; error?: string }>(
    'quote-sync-promo-champions',
    {
      body: {
        quote_id: quoteId,
        quote_number: quote.quote_number,
        status: quote.status,
        client_id: quote.client_id,
        client_name: quote.client_name,
        total: quote.total,
        updated_at: quote.updated_at,
        seller_email: userEmail,
      },
    },
  );

  if (error || data?.ok === false) {
    const msg = data?.error || error?.message || 'Erro desconhecido';
    await logQuoteHistory(
      quoteId,
      'sync_error',
      `Falha ao sincronizar com Promo Champions: ${msg}`,
    );
    throw new Error(msg);
  }

  await logQuoteHistory(quoteId, 'sync_success', 'Sincronizado com Promo Champions', {
    correlation_key: correlationKey,
  });

  toast.success('Orçamento enviado ao Promo Champions!');
  return { success: true };
}
