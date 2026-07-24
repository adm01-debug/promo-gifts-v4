import type { SecretStatus } from '@/hooks/admin';

const BITRIX24_DOMAIN_RE = /^[a-z0-9-]+\.bitrix24\.[a-z.]+$/i;
const POSITIVE_INT_RE = /^[1-9][0-9]*$/;
const ALPHANUMERIC_TOKEN_RE = /^[a-z0-9]{10,60}$/i;
const WHITESPACE_RE = /\s/;

export interface ValidatorRule {
  /** Returns true if the value is a valid format. */
  test: (v: string) => boolean;
  /** Inline error message when invalid. */
  message: string;
  /** Hint shown in muted text below the input. */
  hint?: string;
  /** Minimum acceptable length to flag a stored value as suspicious. */
  minLength?: number;
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  hint?: string;
}

const isHttpsUrl = (v: string): URL | null => {
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
};

const isJwt = (v: string): boolean => {
  if (!v.startsWith('eyJ')) return false;
  const parts = v.split('.');
  if (parts.length !== 3) return false;
  return v.length >= 100;
};

function urlEndsWithSupabase(v: string): ValidationResult {
  const u = isHttpsUrl(v);
  if (!u) return { ok: false, message: 'URL deve começar com https://' };
  if (v.endsWith('/')) return { ok: false, message: "Remova a barra final ('/')." };
  if (!u.hostname.endsWith('.supabase.co'))
    return { ok: false, message: 'Host deve terminar em .supabase.co' };
  return { ok: true };
}

function jwtRule(label: string, v: string): ValidationResult {
  if (!isJwt(v)) {
    return {
      ok: false,
      message: `${label} deve ser um JWT válido (eyJ…, 3 segmentos, ≥100 chars)${v.length > 0 ? ` — atual: ${v.length} chars` : ''}`,
    };
  }
  return { ok: true };
}

export const SECRET_VALIDATORS: Record<string, ValidatorRule> = {
  EXTERNAL_PROMOBRIND_URL: {
    test: (v) => urlEndsWithSupabase(v).ok,
    message: 'URL deve ser https://abc.supabase.co (sem barra final).',
    hint: 'Formato esperado: https://<projeto>.supabase.co',
    minLength: 25,
  },
  EXTERNAL_CRM_URL: {
    test: (v) => urlEndsWithSupabase(v).ok,
    message: 'URL deve ser https://abc.supabase.co (sem barra final).',
    hint: 'Formato esperado: https://<projeto>.supabase.co',
    minLength: 25,
  },
  EXTERNAL_PROMOBRIND_ANON_KEY: {
    test: isJwt,
    message: 'Anon Key deve ser um JWT (eyJ…, ≥100 chars).',
    hint: 'Token JWT do Supabase (eyJ…)',
    minLength: 100,
  },
  EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY: {
    test: isJwt,
    message: 'Service Role Key deve ser um JWT (eyJ…, ≥100 chars).',
    hint: 'Token JWT do Supabase (eyJ…)',
    minLength: 100,
  },
  EXTERNAL_CRM_ANON_KEY: {
    test: isJwt,
    message: 'Anon Key deve ser um JWT (eyJ…, ≥100 chars).',
    hint: 'Token JWT do Supabase (eyJ…)',
    minLength: 100,
  },
  EXTERNAL_CRM_SERVICE_ROLE_KEY: {
    test: isJwt,
    message: 'Service Role Key deve ser um JWT (eyJ…, ≥100 chars).',
    hint: 'Token JWT do Supabase (eyJ…)',
    minLength: 100,
  },
  BITRIX24_WEBHOOK_URL: {
    test: (v) => {
      const u = isHttpsUrl(v);
      if (!u) return false;
      if (!v.includes('/rest/')) return false;
      if (!v.endsWith('/')) return false;
      return true;
    },
    message: 'Webhook deve ser https://…/rest/<id>/<token>/ (com barra no final).',
    hint: 'Ex: https://seudominio.bitrix24.com.br/rest/1/abc123xyz/',
    minLength: 60,
  },
  BITRIX24_DOMAIN: {
    test: (v) => BITRIX24_DOMAIN_RE.test(v) && !v.includes('://'),
    message: 'Domínio sem https://, ex: minhaempresa.bitrix24.com.br',
    hint: 'Apenas o host (sem https://, sem barra)',
  },
  BITRIX24_USER_ID: {
    test: (v) => POSITIVE_INT_RE.test(v),
    message: 'User ID deve ser um inteiro positivo.',
    hint: 'Ex: 1',
  },
  BITRIX24_TOKEN: {
    test: (v) => ALPHANUMERIC_TOKEN_RE.test(v),
    message: 'Token deve ser alfanumérico (10–60 caracteres).',
  },
  N8N_BASE_URL: {
    test: (v) => {
      const u = isHttpsUrl(v);
      if (!u) return false;
      if (v.endsWith('/')) return false;
      if (u.pathname && u.pathname !== '/' && u.pathname !== '') return false;
      return true;
    },
    message: 'Apenas o host: https://n8n.suaempresa.com (sem caminho, sem barra final).',
    hint: 'Ex: https://n8n.suaempresa.com',
    minLength: 15,
  },
  N8N_API_KEY: {
    test: (v) => v.length >= 20 && !WHITESPACE_RE.test(v),
    message: 'API Key deve ter ≥20 chars e nenhum espaço.',
    minLength: 20,
  },
  MCP_SERVER_URL: {
    test: (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'https:' || u.protocol === 'wss:';
      } catch {
        return false;
      }
    },
    message: 'URL deve usar https:// ou wss://',
    minLength: 15,
  },
};

const DEFAULT_RULE: ValidatorRule = {
  test: (v) => v.length >= 4,
  message: 'Valor deve ter pelo menos 4 caracteres.',
};

/**
 * Comprimento mínimo absoluto para qualquer secret. O sufixo mascarado
 * exibido na UI (••••XXXX) é sempre os últimos 4 caracteres do valor —
 * permitir <4 chars quebraria a renderização e impediria a auditoria.
 */
export const MIN_SUFFIX_LENGTH = 4;

export function validateSecret(name: string, value: string): ValidationResult {
  const rule = SECRET_VALIDATORS[name] ?? DEFAULT_RULE;
  if (value.length === 0) {
    return { ok: false, hint: rule.hint };
  }
  // Guarda inviolável: sufixo mascarado exige exatamente 4 caracteres.
  // Aplicada antes do validador específico para garantir mensagem clara
  // mesmo em secrets com regras customizadas (ex: BITRIX24_DOMAIN).
  if (value.length < MIN_SUFFIX_LENGTH) {
    return {
      ok: false,
      message: `Valor muito curto: ${value.length} ${value.length === 1 ? 'caractere' : 'caracteres'}. O sufixo mascarado (••••XXXX) exige pelo menos ${MIN_SUFFIX_LENGTH} caracteres para ser exibido com segurança.`,
      hint: rule.hint,
    };
  }
  if (rule.test(value)) {
    return { ok: true, hint: rule.hint };
  }
  // Specialized message for Supabase URLs
  if (name === 'EXTERNAL_PROMOBRIND_URL' || name === 'EXTERNAL_CRM_URL') {
    const detail = urlEndsWithSupabase(value);
    if (!detail.ok) return { ok: false, message: detail.message, hint: rule.hint };
  }
  if (
    name === 'EXTERNAL_PROMOBRIND_ANON_KEY' ||
    name === 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY' ||
    name === 'EXTERNAL_CRM_ANON_KEY' ||
    name === 'EXTERNAL_CRM_SERVICE_ROLE_KEY'
  ) {
    const label = name.includes('SERVICE_ROLE') ? 'Service Role Key' : 'Anon Key';
    return { ok: false, message: jwtRule(label, value).message, hint: rule.hint };
  }
  return { ok: false, message: rule.message, hint: rule.hint };
}

/**
 * Returns true if any of the given saved secrets has a length below the
 * validator's minLength threshold (i.e. looks suspicious / probably truncated
 * or wrong).
 */
export function hasSuspiciousLength(secrets: SecretStatus[], names: string[]): boolean {
  for (const name of names) {
    const rule = SECRET_VALIDATORS[name];
    if (!rule?.minLength) continue;
    const s = secrets.find((x) => x.name === name);
    if (!s?.has_value) continue;
    if ((s.length ?? 0) < rule.minLength) return true;
  }
  return false;
}

export function getMinLength(name: string): number | undefined {
  return SECRET_VALIDATORS[name]?.minLength;
}

export function getSecretHint(name: string): string | undefined {
  return SECRET_VALIDATORS[name]?.hint;
}

export interface PreflightIssue {
  name: string;
  label: string;
  reason: 'missing' | 'too_short';
  message: string;
  hint?: string;
  currentLength?: number;
  minLength?: number;
}

/**
 * Returns a list of pre-flight issues for the given secret names. A field is
 * flagged when it is required but absent, or when its stored length is below
 * the validator's minLength (likely truncated / wrong format).
 *
 * Used to block "Testar conexão" with a clear inline explanation.
 */
export function getPreflightIssues(
  secrets: SecretStatus[],
  required: { name: string; label: string }[],
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  for (const { name, label } of required) {
    const rule = SECRET_VALIDATORS[name];
    const s = secrets.find((x) => x.name === name);
    if (!s?.has_value) {
      issues.push({
        name,
        label,
        reason: 'missing',
        message: `${label} não está configurado.`,
        hint: rule?.hint,
      });
      continue;
    }
    if (rule?.minLength && (s.length ?? 0) < rule.minLength) {
      issues.push({
        name,
        label,
        reason: 'too_short',
        message: `${label} tem ${s.length} caracteres (mínimo esperado: ${rule.minLength}). Provavelmente truncado ou em formato errado.`,
        hint: rule.hint,
        currentLength: s.length ?? 0,
        minLength: rule.minLength,
      });
    }
  }
  return issues;
}
