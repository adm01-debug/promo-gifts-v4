/**
 * correlationId — SSOT de normalização/validação de correlation_id
 *
 * Regras (endurecidas em 2026-07):
 *   - VÁLIDO quando é `string` com `trim().length > 0` — reutilizamos o valor
 *     recebido (permite propagar CID do `delete_ok` no `restore_start`/`restore_ok`).
 *   - INVÁLIDO em qualquer outro caso (`undefined`, `null`, número, boolean,
 *     objeto, array, string vazia, só-whitespace) — geramos um novo via
 *     `newRequestId()` para evitar telemetria com CID `""` / `undefined`.
 *
 * Extraído de `SellerCartContext.tsx` para permitir reuso (Kit Maker, Coleções,
 * Favoritos — todos os fluxos com correlação delete→undo) e testes unitários
 * cobrindo strings vazias, só-whitespace e tipos inesperados.
 */
import { newRequestId } from './requestId';

/**
 * UUID v4 canônico (formato RFC 4122): 8-4-4-4-12 com dígito de versão 4
 * e variant bits `[89ab]`. Mesmo formato produzido por `crypto.randomUUID`
 * e pelo fallback de `newRequestId`.
 */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `true` para strings não-vazias após `trim()`. Falso para todo o resto. */
export function isValidCorrelationId(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.trim().length > 0;
}

/** `true` quando `raw` é string no formato UUID v4. */
export function isUuidV4(raw: unknown): boolean {
  return typeof raw === 'string' && UUID_V4_REGEX.test(raw);
}

/**
 * Reutiliza `raw` se válido (regra `isValidCorrelationId`), senão gera um
 * novo CID UUID v4 via `newRequestId()`. Nunca retorna string vazia/whitespace.
 */
export function normalizeCorrelationId(raw: unknown): string {
  return isValidCorrelationId(raw) ? raw : newRequestId();
}
