/**
 * Bridge entre o event bus de status do bridge e a tabela `query_telemetry`.
 *
 * Sempre que o cliente detecta um 503/cold-start (mesmo que o retry recupere),
 * grava uma linha via RPC `record_platform_failure`. Isso garante que o painel
 * /admin/telemetria veja falhas de plataforma que nem chegam ao edge function
 * (porque o isolate morreu antes de executar).
 *
 * Inicialização: chamado uma vez em `App.tsx` via efeito.
 */
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { onBridgeStatus } from './bridge-status-events';
import { logger } from '@/lib/logger';

let started = false;

// Throttle: 1 registro a cada 4s para evitar spam quando 6 prewarms paralelos
// batem cold start juntos. Eventos extras dentro da janela são contabilizados
// como retry_count para preservar a contagem real.
const THROTTLE_MS = 4000;
let lastSentAt = 0;
let pendingRetries = 0;

export function startBridgeTelemetry(): () => void {
  if (started) return () => {};
  started = true;

  const unsubscribe = onBridgeStatus((event) => {
    // Só registramos eventos críticos (degraded/unavailable) — `recovered` é só UI.
    if (event.type === 'recovered') return;

    const now = Date.now();
    pendingRetries += 1;

    if (now - lastSentAt < THROTTLE_MS) return;
    lastSentAt = now;

    const retries = pendingRetries;
    pendingRetries = 0;

    const payload =
      event.type === 'unavailable'
        ? {
            p_operation: 'bridge_call',
            p_error_message: event.reason.slice(0, 500),
            p_is_503: true,
            p_is_cold_start: true,
            p_retry_count: Math.max(retries, event.attempts),
            p_duration_ms: 0,
          }
        : {
            p_operation: 'bridge_call',
            p_error_message: event.reason.slice(0, 500),
            p_is_503: true,
            p_is_cold_start: true,
            p_retry_count: retries,
            p_duration_ms: event.delayMs,
          };

    // Fire-and-forget — falha de telemetria não pode quebrar o app.
    void getSupabaseClient()
      .then((supabase) => supabase.rpc('record_platform_failure', payload))
      .then(({ error }) => {
        if (error) logger.warn('[bridge-telemetry] RPC failed:', error.message);
      })
      .catch((error) => {
        logger.warn('[bridge-telemetry] RPC failed:', String(error));
      });
  });

  return () => {
    unsubscribe();
    started = false;
  };
}
