/**
 * db-retry — política de retry compartilhada para queries do React Query.
 *
 * CONTEXTO (2026-07-17 — incidente 403 mv_stock_velocity / mv_product_intelligence):
 * As views wrapper de `public` perderam acesso à matview subjacente em `analytics`
 * após a conversão para `security_invoker=true`. O PostgREST passou a devolver 403.
 * Cada hook então retentava 3x um erro que NUNCA se resolveria, multiplicado por
 * ~96 produtos × 2 hooks = ~768 requests condenados por render.
 *
 * REGRA: erro permanente (401/403/404 · PG 42501 · PGRST205) não se resolve com
 * retry — só amplifica carga e arrisca disparar rate-limit. Apenas erro transitório
 * (rede, timeout, 5xx, 429) merece nova tentativa.
 *
 * Espelha a allowlist já adotada em `src/lib/external-db/rest-native.ts`
 * (isRetryableError), agora reutilizável pela camada de hooks.
 *
 * @see src/hooks/intelligence/useStockHistory.ts
 * @see src/hooks/intelligence/useStockVelocityPrefetch.ts
 */

/** Tentativas totais padrão (1 inicial + 2 retries) para erros transitórios. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Erros permanentes — nunca retentar. Avaliado ANTES da allowlist transitória,
 * pois uma mensagem pode conter ambos os sinais (ex.: "failed to fetch: 403").
 */
const PERMANENT_PATTERNS: readonly string[] = [
  'permission denied', // PostgREST 403 / PG 42501
  '42501',
  'insufficient_privilege',
  'jwt expired',
  'invalid api key',
  'not been populated', // MV existe mas ainda sem REFRESH
  'não mapeada',
  'nao mapeada',
  'does not exist', // PG 42P01
  'pgrst205', // tabela ausente do schema cache
  'pgrst301', // JWT inválido
];

/** Erros transitórios — vale retentar. Allowlist: o default é NÃO retentar. */
const TRANSIENT_PATTERNS: readonly string[] = [
  'fetch',
  'network',
  'timeout',
  'aborted',
  'econnreset',
  'socket hang up',
  'rate limit',
  '429',
  '502',
  '503',
  '504',
];

/** Status HTTP transitórios, quando o erro preserva o status. */
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
};

/** Achata mensagem/code/details/hint num único texto pesquisável. */
function signalsOf(error: unknown): { text: string; status?: number } {
  if (typeof error === 'string') return { text: error.toLowerCase() };
  if (error === null || typeof error !== 'object') return { text: '' };

  const e = error as ErrorLike;
  const parts: string[] = [];
  if (error instanceof Error) parts.push(error.message);
  for (const field of [e.message, e.code, e.details, e.hint]) {
    if (typeof field === 'string' || typeof field === 'number') parts.push(String(field));
  }

  const status = typeof e.status === 'number' ? e.status : undefined;
  return { text: parts.join(' | ').toLowerCase(), status };
}

/**
 * `true` quando o erro jamais se resolverá por nova tentativa
 * (permissão, autenticação, objeto inexistente, MV não populada).
 */
export function isPermanentDbError(error: unknown): boolean {
  const { text, status } = signalsOf(error);

  // Status explícito manda: 4xx é permanente, exceto 408/429.
  if (status !== undefined) {
    if (TRANSIENT_STATUS.has(status)) return false;
    if (status >= 400 && status < 500) return true;
  }

  return PERMANENT_PATTERNS.some((p) => text.includes(p));
}

/** `true` apenas para falhas reconhecidamente transitórias. */
export function isTransientDbError(error: unknown): boolean {
  if (isPermanentDbError(error)) return false;

  const { text, status } = signalsOf(error);
  if (status !== undefined && TRANSIENT_STATUS.has(status)) return true;

  return TRANSIENT_PATTERNS.some((p) => text.includes(p));
}

/**
 * Política de retry para `useQuery({ retry })`.
 *
 * Retenta somente erro transitório, até `maxAttempts` tentativas totais.
 * Erro permanente falha na primeira — sem storm.
 *
 * @example
 *   useQuery({ queryKey, queryFn, retry: dbQueryRetry });
 *   useQuery({ queryKey, queryFn, retry: makeDbQueryRetry(1) }); // best-effort
 */
export function dbQueryRetry(failureCount: number, error: unknown): boolean {
  return isTransientDbError(error) && failureCount < DEFAULT_MAX_ATTEMPTS - 1;
}

/** Variante com teto customizado de tentativas. */
export function makeDbQueryRetry(
  maxAttempts: number,
): (failureCount: number, error: unknown) => boolean {
  return (failureCount, error) => isTransientDbError(error) && failureCount < maxAttempts - 1;
}
