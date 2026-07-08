/**
 * Telemetria persistente de handoffs do QuoteBuilder (BUG-CART-HANDOFF, 2026-07).
 *
 * Objetivo: registrar em `frontend_telemetry` cada vez que o QuoteBuilder é
 * populado por uma fonte externa (carrinho, coleção, simulador ou URL params),
 * para que o painel `/admin/telemetria` confirme que o handoff está chegando
 * em PROD e detecte regressões (autosave sobrescrevendo dados novos).
 *
 * Fire-and-forget: falhas de rede/RLS NUNCA quebram o fluxo do usuário.
 * Sem PII: apenas contadores + IDs opacos + fonte.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type QuoteHandoffSource =
  | 'fromCart'
  | 'fromCollection'
  | 'fromSimulator'
  | 'fromUrlParams'
  | 'fromUrlParamsSingle';

export interface QuoteHandoffMetadata {
  items_count?: number;
  company_id?: string | null;
  company_name?: string | null;
  collection_name?: string | null;
  product_id?: string | null;
  has_color?: boolean;
}

const EVENT_TYPE = 'quote_builder_handoff';

export function trackQuoteHandoff(
  source: QuoteHandoffSource,
  metadata: QuoteHandoffMetadata = {},
): void {
  // Sempre loga para DEV/console — mantém a auditoria local que já existia.
  logger.info(`[QuoteBuilder handoff] ${source}`, metadata);

  // Persistência assíncrona; qualquer falha vira warn e nunca propaga.
  void (async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : null;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from('frontend_telemetry').insert({
        event_type: EVENT_TYPE,
        name: source,
        metadata: metadata as Record<string, unknown>,
        url,
        user_agent: userAgent,
        user_id: userRes?.user?.id ?? null,
      });
    } catch (err) {
      logger.warn('[QuoteBuilder handoff] telemetry insert failed', {
        source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

export const QUOTE_HANDOFF_EVENT_TYPE = EVENT_TYPE;
