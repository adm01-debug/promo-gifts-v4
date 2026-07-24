/**
 * Telemetria de transições de status de orçamento.
 *
 * Emite `quote_status_transition_blocked` (warn estruturado) sempre que
 * uma tentativa de transição é barrada — seja pelo guarda do FE
 * (QUOTE_VALID_TRANSITIONS), seja pelo CHECK constraint do banco
 * (SQLSTATE 23514). Permite consultar no painel de observabilidade
 * "quem tenta forçar draft→converted" e similares.
 */
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

const log = createClientLogger('quote_status_transition');

export type InvalidTransitionReason =
  'db_check_violation' | 'not_allowed_by_config' | 'out_of_enum';

export type InvalidTransitionSource = 'db' | 'service' | 'ui';

export interface InvalidTransitionPayload {
  quoteId: string | null;
  from: string | null;
  to: string | null;
  reason: InvalidTransitionReason;
  source: InvalidTransitionSource;
  /** Opcional: detalhes do erro do banco (code, hint) quando reason='db_check_violation'. */
  dbError?: { code?: string; hint?: string | null; constraint?: string | null };
}

export function logInvalidStatusTransition(payload: InvalidTransitionPayload): void {
  log.warn('quote_status_transition_blocked', {
    quote_id: payload.quoteId,
    from_status: payload.from,
    to_status: payload.to,
    reason: payload.reason,
    source: payload.source,
    ...(payload.dbError ? { db_error: payload.dbError } : {}),
  });
}
