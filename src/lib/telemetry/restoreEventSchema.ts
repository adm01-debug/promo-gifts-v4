/**
 * restoreEventSchema — validação de payload dos eventos de telemetria do
 * fluxo `delete → undo` (SellerCartContext / Coleções / Favoritos).
 *
 * Motivação: garantir que TODOS os eventos de restore que caem no logger
 * estruturado (e no Sentry) obedecem um contrato mínimo — evita dashboards
 * "sujos" com `duration_ms: undefined`, `correlation_id: null` ou
 * `restore_result` fora do enum.
 *
 * O validador é PURO (sem side effects): devolve `{ valid, violations }`.
 * O caller decide o que fazer (emitir `restore_event_schema_violation` como
 * warn, ou ignorar em prod). NÃO lança em runtime — telemetria nunca deve
 * quebrar o fluxo do usuário.
 */

export type RestoreEventName =
  | 'restore_failed'
  | 'restore_ok'
  | 'restore_skipped_empty_snapshot'
  | 'restore_start';

/**
 * Versão canônica do schema dos eventos de restore.
 * Incremente ao mudar campos obrigatórios/enums; o validador aceita
 * `schema_version` AUSENTE (compat legado) mas rejeita tipos inválidos.
 * Consumidores em produção devem comparar contra este número para saber
 * quais campos podem existir.
 */
export const RESTORE_EVENT_SCHEMA_VERSION = 2 as const;

const OK_RESULTS = new Set(['success', 'partial', 'deduped', 'ok_no_metrics']);
const FAILED_RESULTS = new Set(['failed']);
const SKIPPED_RESULTS = new Set(['skipped_empty']);

export interface SchemaViolation {
  field: string;
  reason: string;
  got: unknown;
}

export interface ValidationResult {
  valid: boolean;
  violations: SchemaViolation[];
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Retorna `{ valid, violations }` — nunca lança. */
export function validateRestoreEvent(
  event: RestoreEventName,
  fields: Record<string, unknown>,
): ValidationResult {
  const violations: SchemaViolation[] = [];

  // 1. correlation_id — obrigatório e string não-vazia em TODOS os eventos.
  const cid = fields.correlation_id;
  if (typeof cid !== 'string' || cid.trim().length === 0) {
    violations.push({
      field: 'correlation_id',
      reason: 'expected non-empty string',
      got: cid,
    });
  }

  // 2. duration_ms — obrigatório em ok/failed/skipped; opcional em start.
  //    Quando presente em start, ainda precisa ser válido.
  const dur = fields.duration_ms;
  const requiresDuration = event !== 'restore_start';
  if (requiresDuration) {
    if (!isFiniteNonNegative(dur)) {
      violations.push({
        field: 'duration_ms',
        reason: 'expected finite number >= 0',
        got: dur,
      });
    }
  } else if (dur !== undefined && !isFiniteNonNegative(dur)) {
    violations.push({
      field: 'duration_ms',
      reason: 'when present in restore_start, must be finite number >= 0',
      got: dur,
    });
  }

  // 3. restore_result — enum específico por evento (start não carrega esse campo).
  if (event !== 'restore_start') {
    const expected =
      event === 'restore_failed'
        ? FAILED_RESULTS
        : event === 'restore_skipped_empty_snapshot'
          ? SKIPPED_RESULTS
          : OK_RESULTS;
    const r = fields.restore_result;
    if (typeof r !== 'string' || !expected.has(r)) {
      violations.push({
        field: 'restore_result',
        reason: `expected one of ${[...expected].join('|')}`,
        got: r,
      });
    }
  }

  // 4. schema_version — OPCIONAL para compat com legados que emitiam sem o
  //    campo; quando presente, deve ser inteiro finito >= 1. Assim o
  //    validador aceita eventos antigos (v1 sem campo) e novos (v2+ com
  //    campo) sem regressão. Regressões futuras devem incrementar a versão
  //    e endurecer os requisitos aqui — nunca quebrar leituras retroativas.
  if (fields.schema_version !== undefined) {
    const sv = fields.schema_version;
    if (
      typeof sv !== 'number' ||
      !Number.isFinite(sv) ||
      !Number.isInteger(sv) ||
      sv < 1
    ) {
      violations.push({
        field: 'schema_version',
        reason: 'when present, must be integer >= 1',
        got: sv,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

