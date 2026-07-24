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
 * (rede, timeout, 5xx, 429, PGRST002) merece nova tentativa.
 *
 * v2 (2026-07-17): suíte de 108 testes adversariais corrigiu 5 bugs:
 *  - '500 Internal Server Error' no texto não era reconhecido como transitório
 *  - '403 + 503' na mesma msg: 4xx agora SEMPRE vence 5xx
 *  - PGRST2059 não deve casar PGRST205 (exactCode com Set)
 *  - statusCode (Supabase Storage) não era lido
 *  - PGRST002 não retentava (faltava check em isTransientDbError)
 *
 * @see src/hooks/intelligence/useStockHistory.ts
 * @see src/hooks/intelligence/useStockVelocityPrefetch.ts
 */

/** Tentativas totais padrão (1 inicial + 2 retries) para erros transitórios. */
export const DEFAULT_MAX_ATTEMPTS = 3;

const PERMANENT_PATTERNS: readonly string[] = [
  'permission denied', // PostgREST 403 / PG 42501
  '42501',
  'insufficient_privilege',
  'jwt expired',
  'invalid api key',
  'not been populated', // MV existe mas sem REFRESH
  'não mapeada',
  'nao mapeada',
  'does not exist', // PG 42P01
  'pgrst301', // JWT inválido (pgrst205 movido para exactCode)
];

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
  'pgrst002', // schema cache indisponível (PostgREST reiniciando)
  'pgrst001', // falha de conexão com o banco
];

/** Status HTTP transitórios quando o campo `status` está presente. */
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Status permanente citado APENAS no texto (rest-native descarta o campo `status`).
 * Word boundary evita casar dígitos dentro de UUIDs.
 * 4xx sempre vence 5xx: quando ambos aparecem, o permanente é detectado no passo 2b.
 */
const PERMANENT_STATUS_IN_TEXT = /\b(?:401|403|404|409|422)\b/;

/** Status transitório citado no texto. Só usado para classificar, não para impedir perm. */
const TRANSIENT_STATUS_IN_TEXT = /\b(?:408|429|500|502|503|504)\b/;

/**
 * Códigos PGRST permanentes — verificados por igualdade exata (não substring),
 * para evitar que PGRST2059 case PGRST205.
 */
const PERMANENT_PGRST_CODES_EXACT = new Set(['pgrst205', 'pgrst301', 'pgrst302']);

/** Códigos PGRST transitórios — avaliados antes do parse numérico do texto. */
const TRANSIENT_CODE_PATTERNS: readonly string[] = ['pgrst002', 'pgrst001'];

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown; // Supabase Storage usa statusCode em vez de status
  details?: unknown;
  hint?: unknown;
};

/** Achata mensagem/code/details/hint num único texto pesquisável. */
function signalsOf(error: unknown): { text: string; status?: number; exactCode?: string } {
  if (typeof error === 'string') return { text: error.toLowerCase() };
  if (error === null || typeof error !== 'object') return { text: '' };

  const e = error as ErrorLike;
  const parts: string[] = [];
  if (error instanceof Error) parts.push(error.message);
  for (const field of [e.message, e.code, e.details, e.hint]) {
    if (typeof field === 'string' || typeof field === 'number') parts.push(String(field));
  }

  // status estruturado: aceita status (PostgREST) e statusCode (Supabase Storage)
  const rawStatus =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : typeof e.statusCode === 'string'
          ? parseInt(e.statusCode, 10) || undefined
          : undefined;
  const status = rawStatus !== undefined && !isNaN(rawStatus) ? rawStatus : undefined;

  const exactCode = typeof e.code === 'string' ? e.code.toLowerCase() : undefined;
  return { text: parts.join(' | ').toLowerCase(), status, exactCode };
}

/**
 * `true` quando o erro jamais se resolverá por nova tentativa.
 *
 * Precedência (ordem importa):
 *  1. Status estruturado (numérico) — fonte mais confiável
 *  2a. Código PGRST exato — match sem substring
 *  2b. Padrão textual permanente
 *  3. Código transitório explícito — vence o parse numérico (passo 4)
 *  4. Status 4xx citado no texto — 4xx SEMPRE vence 5xx mesmo na mesma mensagem
 */
export function isPermanentDbError(error: unknown): boolean {
  const { text, status, exactCode } = signalsOf(error);

  // 1. Status estruturado: 4xx é permanente, exceto 408/429.
  if (status !== undefined) {
    if (TRANSIENT_STATUS.has(status)) return false;
    if (status >= 400 && status < 500) return true;
  }

  // 2a. Código PGRST permanente — match exato.
  if (exactCode !== undefined && PERMANENT_PGRST_CODES_EXACT.has(exactCode)) return true;

  // 2b. Sinal textual permanente.
  if (PERMANENT_PATTERNS.some((p) => text.includes(p))) return true;

  // 3. Código transitório explícito vence o passo 4.
  if (TRANSIENT_CODE_PATTERNS.some((p) => text.includes(p))) return false;

  // 4. Status 4xx só no texto (rest-native descarta o campo `status`).
  //    4xx vence 5xx mesmo quando ambos aparecem na mesma mensagem.
  if (PERMANENT_STATUS_IN_TEXT.test(text)) return true;

  return false;
}

/** `true` apenas para falhas reconhecidamente transitórias. */
export function isTransientDbError(error: unknown): boolean {
  if (isPermanentDbError(error)) return false;

  const { text, status, exactCode } = signalsOf(error);
  if (status !== undefined && TRANSIENT_STATUS.has(status)) return true;

  // Código PGRST transitório — match exato antes do parse de texto.
  if (exactCode !== undefined && TRANSIENT_CODE_PATTERNS.includes(exactCode)) return true;

  // Status 5xx só no texto.
  if (TRANSIENT_STATUS_IN_TEXT.test(text)) return true;

  return TRANSIENT_PATTERNS.some((p) => text.includes(p));
}

/**
 * Política de retry para `useQuery({ retry })`.
 * Retenta somente erro transitório, até `maxAttempts` tentativas totais.
 *
 * @example
 *   useQuery({ retry: dbQueryRetry });
 *   useQuery({ retry: makeDbQueryRetry(1) }); // best-effort (0 retries)
 */
export function dbQueryRetry(failureCount: number, error: unknown): boolean {
  return isTransientDbError(error) && failureCount < DEFAULT_MAX_ATTEMPTS - 1;
}

export function makeDbQueryRetry(
  maxAttempts: number,
): (failureCount: number, error: unknown) => boolean {
  return (failureCount, error) => isTransientDbError(error) && failureCount < maxAttempts - 1;
}
