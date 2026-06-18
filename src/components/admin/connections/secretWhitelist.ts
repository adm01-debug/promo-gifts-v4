/**
 * Frontend mirror of the backend whitelist enforced by the
 * `secrets-manager` edge function. MUST stay in sync with
 * `supabase/functions/secrets-manager/index.ts` (ALLOWED_SECRETS / ALLOWED_PREFIXES).
 *
 * Used to fail fast in the UI before issuing a network call.
 */

export const ALLOWED_SECRET_NAMES: ReadonlySet<string> = new Set([
  'EXTERNAL_PROMOBRIND_URL',
  'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY',
  'EXTERNAL_PROMOBRIND_ANON_KEY',
  'EXTERNAL_CRM_URL',
  'EXTERNAL_CRM_SERVICE_ROLE_KEY',
  'EXTERNAL_CRM_ANON_KEY',
  'BITRIX24_WEBHOOK_URL',
  'BITRIX24_DOMAIN',
  'BITRIX24_USER_ID',
  'BITRIX24_TOKEN',
  'N8N_BASE_URL',
  'N8N_API_KEY',
  'MCP_SHARED_SECRET',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'GITHUB_DEFAULT_BRANCH',
]);

export const ALLOWED_SECRET_PREFIXES: readonly string[] = [
  'OUTBOUND_WEBHOOK_SECRET_',
  'INBOUND_WEBHOOK_HMAC_',
];

/** Conservative pattern: uppercase, digits and underscores only. */
const NAME_SHAPE = /^[A-Z][A-Z0-9_]{2,63}$/;

export interface SecretNameValidation {
  ok: boolean;
  /** Stable code so callers can branch (e.g. show different chips). */
  code?: 'empty' | 'bad_shape' | 'not_whitelisted';
  message?: string;
  hint?: string;
}

/**
 * Validates a secret name against the same rules the backend enforces.
 * Returns `{ ok: true }` only when the name is in the whitelist OR matches
 * one of the allowed prefixes AND has a sane shape.
 */
export function validateSecretName(name: string): SecretNameValidation {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return {
      ok: false,
      code: 'empty',
      message: 'Informe o nome da credencial.',
    };
  }

  if (ALLOWED_SECRET_NAMES.has(trimmed)) {
    return { ok: true };
  }

  // Prefix-based names still need a sane shape
  const matchedPrefix = ALLOWED_SECRET_PREFIXES.find((p) => trimmed.startsWith(p));
  if (matchedPrefix) {
    if (!NAME_SHAPE.test(trimmed)) {
      return {
        ok: false,
        code: 'bad_shape',
        message: `Nomes com prefixo ${matchedPrefix} devem usar apenas A–Z, 0–9 e _ (3–64 chars).`,
        hint: `Ex: ${matchedPrefix}MEU_SISTEMA`,
      };
    }
    return { ok: true };
  }

  return {
    ok: false,
    code: 'not_whitelisted',
    message: `O nome "${trimmed}" não está na lista permitida de credenciais.`,
    hint: `Aceitos: ${[...ALLOWED_SECRET_NAMES].slice(0, 4).join(', ')}… ou prefixos ${ALLOWED_SECRET_PREFIXES.join(', ')}`,
  };
}

export function isAllowedSecretName(name: string): boolean {
  return validateSecretName(name).ok;
}
