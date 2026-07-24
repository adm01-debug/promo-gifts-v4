/**
 * sanitize-error — Mapeia erros sensíveis vindos de edges/RPCs para mensagens
 * genéricas exibidas na UI. Detalhes técnicos (motivos de RLS, role lost,
 * password mismatch, grant forbidden, etc.) NUNCA chegam ao usuário final;
 * permanecem apenas nos audit logs server-side.
 *
 * Regra de ouro: para qualquer falha de autorização/credencial, mostre
 * a MESMA mensagem ("Não foi possível concluir esta operação. Verifique
 * suas credenciais e tente novamente.") para evitar enumeration attacks.
 */

/** Mensagens públicas reutilizáveis. */
export const SAFE_MESSAGES = {
  AUTH_GENERIC:
    'Não foi possível concluir esta operação. Verifique suas credenciais e tente novamente.',
  AUTH_DENIED: 'Acesso negado.',
  STEP_UP_FAILED: 'Não foi possível confirmar sua identidade. Tente novamente.',
  STEP_UP_EXPIRED: 'Sua confirmação expirou. Refaça a verificação.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  VALIDATION: 'Verifique os dados informados e tente novamente.',
  GENERIC: 'Operação não pôde ser concluída. Tente novamente em instantes.',
} as const;

/**
 * Códigos de erro que NUNCA devem ser repassados textualmente.
 * Qualquer um destes vira AUTH_GENERIC ou AUTH_DENIED.
 */
const SENSITIVE_CODES = new Set([
  'unauthenticated',
  'unauthorized',
  'forbidden',
  'not_dev',
  'dev_role_required',
  'role_required',
  'role_check_failed',
  'role_lost_at_consume',
  'full_grant_forbidden',
  'grant_check_failed',
  'step_up_required',
  'step_up_invalid',
  'invalid_password',
  'password_not_verified_first',
  'wrong_otp',
  'wrong_password',
  'max_attempts_exceeded',
  'challenge_invalid',
  'invalid_or_expired_challenge',
  'token_invalid_or_expired',
  'action_mismatch',
  'target_mismatch',
  'rate_limited',
]);

interface ErrorLike {
  message?: string;
  error?: string;
  code?: string;
  status?: number;
  details?: unknown;
}

const CONTROLLED_INTERNAL_FAILURE_PATTERNS: readonly RegExp[] = [
  /dependency.+(?:unavailable|down|missing|timeout)/i,
  /service.+temporarily unavailable/i,
  /failed to fetch/i,
  /network(?:error| timeout)?/i,
  /econnrefused|etimedout|enotfound/i,
  /supabase_edge_runtime_error/i,
  /boot_error/i,
];

function isControlledInternalFailure(input: ErrorLike): boolean {
  const code = String(input.code ?? input.error ?? '').toLowerCase();
  if (['dependency_unavailable', 'upstream_unavailable', 'service_unavailable'].includes(code)) {
    return true;
  }

  const haystack = [input.message, input.error]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return CONTROLLED_INTERNAL_FAILURE_PATTERNS.some((pattern) => pattern.test(haystack));
}

/**
 * Recebe a resposta de uma edge function ou um Error e devolve uma
 * mensagem segura para exibir ao usuário.
 *
 * @example
 *   const { data, error } = await supabase.functions.invoke("mcp-keys-issue", { body });
 *   if (error || data?.error) {
 *     toast.error(sanitizeError(data ?? error));
 *     return;
 *   }
 */
export function sanitizeError(input: unknown): string {
  if (!input) return SAFE_MESSAGES.GENERIC;

  const obj = (typeof input === 'object' ? input : {}) as ErrorLike;
  const code = String(obj.error ?? obj.code ?? '').toLowerCase();
  const status = obj.status ?? 0;

  // 401/403 → sempre genérico (não diferencia autenticação de autorização)
  if (status === 401 || status === 403) return SAFE_MESSAGES.AUTH_GENERIC;

  if (SENSITIVE_CODES.has(code)) {
    if (code === 'rate_limited') return SAFE_MESSAGES.RATE_LIMITED;
    if (code === 'step_up_required' || code === 'step_up_invalid')
      return SAFE_MESSAGES.STEP_UP_EXPIRED;
    return SAFE_MESSAGES.AUTH_GENERIC;
  }

  if (status === 422 || code === 'validation_failed') return SAFE_MESSAGES.VALIDATION;
  if (status === 429) return SAFE_MESSAGES.RATE_LIMITED;

  // Falhas internas controladas (dependência indisponível, timeout upstream etc.)
  // devem sempre retornar uma mensagem pública genérica para evitar vazamento.
  if (isControlledInternalFailure(obj)) return SAFE_MESSAGES.GENERIC;
  if (status >= 500) return SAFE_MESSAGES.GENERIC;

  // Códigos não-sensíveis: pode usar a mensagem (já é da nossa Zod) — fallback genérico
  return SAFE_MESSAGES.GENERIC;
}
