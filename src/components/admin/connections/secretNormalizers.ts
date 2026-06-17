/**
 * Pure normalizers applied BEFORE validation to fix common copy/paste mistakes.
 *
 * Rules:
 *  - Never change semantics (don't swap http→https, don't decode base64, etc.)
 *  - Always idempotent: normalize(normalize(x)) === normalize(x)
 *  - Return a list of human-readable change descriptions for UI feedback
 */

const WHITESPACE_RE = /\s/;
const WHITESPACE_GLOBAL_RE = /\s+/g;
const BEARER_PREFIX_RE = /^Bearer\s+(.+)$/i;
const PROTOCOL_RE = /^https?:\/\//i;
const TRAILING_SLASHES_RE = /\/+$/;
const NON_DIGITS_RE = /\D+/g;
const HMAC_SECRET_NAME_RE = /_HMAC_|_SECRET_|_HMAC$|_SECRET$/;

export interface NormalizationResult {
  value: string;
  changes: string[];
}

function stripQuotes(s: string, changes: string[]): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      changes.push('aspas envolventes removidas');
      return s.slice(1, -1);
    }
  }
  return s;
}

function trimEdges(s: string, changes: string[]): string {
  const t = s.trim();
  if (t !== s) changes.push('espaços removidos');
  return t;
}

function stripAllWhitespace(s: string, changes: string[]): string {
  if (WHITESPACE_RE.test(s)) {
    changes.push('quebras de linha removidas');
    return s.replace(WHITESPACE_GLOBAL_RE, '');
  }
  return s;
}

function stripBearer(s: string, changes: string[]): string {
  const m = s.match(BEARER_PREFIX_RE);
  if (m) {
    changes.push('prefixo Bearer removido');
    return m[1];
  }
  return s;
}

function normalizeSupabaseUrl(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  v = trimEdges(v, changes);
  try {
    const u = new URL(v);
    const host = u.hostname.toLowerCase();
    if (host !== u.hostname) changes.push('host normalizado para minúsculas');
    const rebuilt = `${u.protocol}//${host}`;
    if (
      rebuilt !== `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, '')}${u.search}${u.hash}`
    ) {
      if (u.pathname && u.pathname !== '/' && u.pathname !== '') changes.push('caminho removido');
      if (u.search) changes.push('query removida');
      if (u.hash) changes.push('fragmento removido');
      if (v.endsWith('/') && rebuilt !== v) changes.push('barra final removida');
    } else if (v.endsWith('/')) {
      changes.push('barra final removida');
    }
    return { value: rebuilt, changes };
  } catch {
    // Not a parseable URL — leave as-is, validator will catch it.
    return { value: v, changes };
  }
}

function normalizeJwt(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  v = stripBearer(v, changes);
  v = stripAllWhitespace(v, changes);
  return { value: v, changes };
}

function normalizeBitrixWebhook(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  try {
    const u = new URL(v);
    if (u.search) changes.push('query removida');
    if (u.hash) changes.push('fragmento removido');
    let path = u.pathname;
    if (!path.endsWith('/')) {
      path += '/';
      changes.push('barra final adicionada');
    }
    return { value: `${u.protocol}//${u.hostname.toLowerCase()}${path}`, changes };
  } catch {
    return { value: v, changes };
  }
}

function normalizeBitrixDomain(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  const before = v;
  v = v.replace(PROTOCOL_RE, '');
  if (v !== before) changes.push('protocolo removido');
  if (v.endsWith('/')) {
    v = v.replace(TRAILING_SLASHES_RE, '');
    changes.push('barra final removida');
  }
  const lower = v.toLowerCase();
  if (lower !== v) changes.push('host normalizado para minúsculas');
  return { value: lower, changes };
}

function normalizeDigitsOnly(raw: string): NormalizationResult {
  const changes: string[] = [];
  const v = trimEdges(raw, changes);
  const stripped = v.replace(NON_DIGITS_RE, '');
  if (stripped !== v) changes.push('caracteres não-numéricos removidos');
  return { value: stripped, changes };
}

function normalizeN8nBaseUrl(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  try {
    const u = new URL(v);
    if (u.pathname && u.pathname !== '/' && u.pathname !== '') changes.push('caminho removido');
    if (u.search) changes.push('query removida');
    if (u.hash) changes.push('fragmento removido');
    if (v.endsWith('/')) changes.push('barra final removida');
    return { value: `${u.protocol}//${u.hostname.toLowerCase()}`, changes };
  } catch {
    return { value: v, changes };
  }
}

function normalizeMcpUrl(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  return { value: v, changes };
}

function normalizeSecretToken(raw: string): NormalizationResult {
  const changes: string[] = [];
  let v = trimEdges(raw, changes);
  v = stripQuotes(v, changes);
  v = stripAllWhitespace(v, changes);
  return { value: v, changes };
}

function normalizeDefault(raw: string): NormalizationResult {
  const changes: string[] = [];
  const v = trimEdges(raw, changes);
  return { value: v, changes };
}

export function normalizeSecret(name: string, raw: string): NormalizationResult {
  if (name === 'EXTERNAL_PROMOBRIND_URL' || name === 'EXTERNAL_CRM_URL') {
    return normalizeSupabaseUrl(raw);
  }
  if (
    name === 'EXTERNAL_PROMOBRIND_ANON_KEY' ||
    name === 'EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY' ||
    name === 'EXTERNAL_CRM_ANON_KEY' ||
    name === 'EXTERNAL_CRM_SERVICE_ROLE_KEY'
  ) {
    return normalizeJwt(raw);
  }
  if (name === 'BITRIX24_WEBHOOK_URL') return normalizeBitrixWebhook(raw);
  if (name === 'BITRIX24_DOMAIN') return normalizeBitrixDomain(raw);
  if (name === 'BITRIX24_USER_ID') return normalizeDigitsOnly(raw);
  if (name === 'BITRIX24_TOKEN') return normalizeSecretToken(raw);
  if (name === 'N8N_BASE_URL') return normalizeN8nBaseUrl(raw);
  if (name === 'N8N_API_KEY') return normalizeJwt(raw);
  if (name === 'MCP_SERVER_URL') return normalizeMcpUrl(raw);
  if (name === 'MCP_SHARED_SECRET') return normalizeSecretToken(raw);
  if (HMAC_SECRET_NAME_RE.test(name)) return normalizeSecretToken(raw);
  return normalizeDefault(raw);
}
