/**
 * Telemetria persistente de handoffs do QuoteBuilder (BUG-CART-HANDOFF, 2026-07).
 *
 * Persiste em `frontend_telemetry` cada handoff externo (carrinho/coleção/
 * simulador/URL params) para que o painel `/admin/telemetria` confirme que o
 * handoff continua chegando após deploy e detecte regressões silenciosas.
 *
 * IMPORTANTE — respeito à RLS `ft_insert_validated`:
 *   O policy WITH CHECK atual só aceita `event_type ∈ {page_view, web_vital,
 *   error, perf, interaction}`. Portanto gravamos SEMPRE:
 *     event_type = 'interaction'
 *     name       = 'quote_builder_handoff:<source>'
 *   Assim o INSERT passa sem precisar alterar a policy central de telemetria.
 *
 * Fire-and-forget: falhas de rede/RLS NUNCA quebram o fluxo do usuário. Sem
 * PII: apenas contadores + IDs opacos + fonte.
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

/** Prefixo do campo `name` que identifica um handoff do QuoteBuilder. */
export const QUOTE_HANDOFF_NAME_PREFIX = 'quote_builder_handoff:';
/** Compatível com a whitelist da RLS `ft_insert_validated`. */
export const QUOTE_HANDOFF_EVENT_TYPE = 'interaction';

export function trackQuoteHandoff(
  source: QuoteHandoffSource,
  metadata: QuoteHandoffMetadata = {},
): void {
  // Auditoria local (DEV/console). Mantém a assinatura histórica.
  logger.info(`[QuoteBuilder handoff] ${source}`, metadata);

  // Persistência assíncrona; qualquer falha vira warn e nunca propaga.
  void (async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : null;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from('frontend_telemetry').insert({
        event_type: QUOTE_HANDOFF_EVENT_TYPE,
        name: `${QUOTE_HANDOFF_NAME_PREFIX}${source}`,
        metadata: (metadata ?? {}) as never,
        url,
        user_agent: userAgent,
        user_id: userRes?.user?.id ?? null,
      });
      if (error) {
        logger.warn('[QuoteBuilder handoff] telemetry insert rejected', {
          source,
          code: error.code,
          message: error.message,
        });
      }
    } catch (err) {
      logger.warn('[QuoteBuilder handoff] telemetry insert failed', {
        source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

