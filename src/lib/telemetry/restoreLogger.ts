/**
 * restoreLogger — SSOT do logger estruturado para fluxos delete→undo.
 *
 * Usado por qualquer feature que implemente "excluir + desfazer":
 *   - `seller_cart.restore` (SellerCartContext — snapshot completo)
 *   - `collections.restore` (Coleções — restore item da lixeira)
 *   - `favorites.restore` (Favoritos — restore item da lixeira)
 *
 * Contrato: para cada emissão, injeta automaticamente `schema_version` do
 * schema canônico, roda `validateRestoreEvent`, e ANTES de emitir dispara
 * `restore_event_schema_violation` (warn) se o payload violar o contrato.
 * Nunca bloqueia a emissão original — telemetria não pode quebrar UX.
 *
 * Também expõe `normalizeCorrelationId` e `generateCorrelationId` para
 * garantir que qualquer feature use o mesmo mecanismo de CID.
 */
import { createClientLogger, type ClientLogger } from './structuredLogger';
import { newRequestId } from './requestId';
import {
  isValidCorrelationId,
  normalizeCorrelationId,
} from './correlationId';
import {
  RESTORE_EVENT_SCHEMA_VERSION,
  validateRestoreEvent,
  type RestoreEventName,
} from './restoreEventSchema';

export type RestoreLogLevel = 'error' | 'info' | 'warn';

export interface RestoreLogger {
  /** Logger cru para eventos fora do schema (ex.: `delete_ok`). */
  readonly log: ClientLogger;
  /** Emite evento canônico com validação + `schema_version`. */
  emit: (
    level: RestoreLogLevel,
    event: RestoreEventName,
    fields: Record<string, unknown>,
  ) => void;
  /** Reutiliza `raw` se válido, senão gera novo CID UUID v4. */
  normalizeCorrelationId: (raw: unknown) => string;
  /** Novo CID UUID v4 sem consultar entrada. */
  generateCorrelationId: () => string;
}

export function createRestoreLogger(scope: string): RestoreLogger {
  const log = createClientLogger(scope);

  const emit: RestoreLogger['emit'] = (level, event, fields) => {
    // Injeta `schema_version` só quando o caller NÃO informou — permite que
    // um consumidor override intencionalmente (ex.: replay de evento antigo).
    const enriched: Record<string, unknown> = {
      schema_version: RESTORE_EVENT_SCHEMA_VERSION,
      ...fields,
    };
    const check = validateRestoreEvent(event, enriched);
    if (!check.valid) {
      const cid = enriched.correlation_id;
      log.warn('restore_event_schema_violation', {
        correlation_id: isValidCorrelationId(cid) ? cid : 'unknown',
        violated_event: event,
        violations: check.violations,
        schema_version: RESTORE_EVENT_SCHEMA_VERSION,
      });
    }
    log[level](event, enriched);
  };

  return {
    log,
    emit,
    normalizeCorrelationId,
    generateCorrelationId: newRequestId,
  };
}
