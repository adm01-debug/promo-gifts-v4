/**
 * Telemetria de eventos de viewMode dos carrinhos.
 *
 * Espelha o padrão de `quoteHandoffTelemetry.ts`:
 *   event_type = 'interaction'          (RLS `ft_insert_validated` whitelist)
 *   name       = 'cart_view_mode:<type>' — daily_reset | change
 *
 * Fire-and-forget: falhas de rede/RLS NUNCA quebram o fluxo do usuário.
 * Sem PII: apenas contadores + IDs opacos.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { CartViewModeEvent, CartViewModeEventEmitter } from './cartViewModePrefs';

export const CART_VIEW_MODE_NAME_PREFIX = 'cart_view_mode:';
export const CART_VIEW_MODE_EVENT_TYPE = 'interaction';

function buildMetadata(event: CartViewModeEvent): Record<string, unknown> {
  if (event.type === 'change') {
    return { from: event.from, to: event.to, backend: event.backend };
  }
  return {
    previous: event.previous,
    previous_date: event.previousDate,
    today: event.today,
    backend: event.backend,
  };
}

/**
 * Emitter concreto pronto para plugar em `loadCartViewMode`/`persistCartViewMode`.
 * Loga em dev (`logger.info`) e persiste em `frontend_telemetry` de forma
 * assíncrona; qualquer falha vira `warn` e nunca propaga.
 */
export const emitCartViewModeEvent: CartViewModeEventEmitter = (event) => {
  logger.info(`[cart-view-mode] ${event.type}`, event);

  void (async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : null;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      const { error } = await supabase.from('frontend_telemetry').insert({
        event_type: CART_VIEW_MODE_EVENT_TYPE,
        name: `${CART_VIEW_MODE_NAME_PREFIX}${event.type}`,
        metadata: buildMetadata(event) as never,
        url,
        user_agent: userAgent,
        user_id: event.uid || null,
      });
      if (error) {
        logger.warn('[cart-view-mode] telemetry insert rejected', {
          type: event.type,
          code: error.code,
          message: error.message,
        });
      }
    } catch (err) {
      logger.warn('[cart-view-mode] telemetry insert failed', {
        type: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
};
