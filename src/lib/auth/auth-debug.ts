/**
 * Auth debug logger — emite logs detalhados (com mascaramento de dados
 * sensíveis) para diagnosticar falhas no fluxo de login social.
 *
 * Visível apenas em DEV ou com `VITE_AUTH_DEBUG=true`, com prefixo
 * `[AUTH-DEBUG]` para facilitar filtragem no DevTools. Não envia nada para o
 * backend.
 */

import type { Session, User } from '@supabase/supabase-js';
import { maskSensitiveText } from '@/lib/sensitive-masking';

const PREFIX = '[AUTH-DEBUG]';
const AUTH_DEBUG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true';

/** Mascara token JWT mostrando apenas 8 primeiros e 6 últimos caracteres. */
function maskToken(token: string | null | undefined): string {
  if (!token) return '<null>';
  if (token.length <= 16) return `${token.slice(0, 4)}…(${token.length})`;
  return `${token.slice(0, 8)}…${token.slice(-6)} (len=${token.length})`;
}

/** Mascara email: `joao.silva@empresa.com` → `j***a@empresa.com`. */
function maskEmail(email: string | null | undefined): string {
  if (!email) return '<null>';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}*${domain}`;
  return `${local[0]}***${local.slice(-1)}${domain}`;
}

/** Decodifica payload de JWT (sem validar assinatura) para inspecionar claims. */
function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function summarizeUser(user: User | null | undefined) {
  if (!user) return { user: null };
  return {
    id: user.id,
    email: maskEmail(user.email ?? null),
    provider: user.app_metadata?.provider,
    providers: user.app_metadata?.providers,
    aud: user.aud,
    role: user.role,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    metadata_keys: Object.keys(user.user_metadata ?? {}),
  };
}

export function summarizeSession(session: Session | null | undefined) {
  if (!session) return { session: null };
  const claims = decodeJwtPayload(session.access_token);
  return {
    access_token: maskToken(session.access_token),
    refresh_token: maskToken(session.refresh_token),
    token_type: session.token_type,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    expires_at_iso: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    provider_token: maskToken(session.provider_token),
    provider_refresh_token: maskToken(session.provider_refresh_token),
    user: summarizeUser(session.user),
    claims: claims
      ? {
          sub: claims.sub,
          aud: claims.aud,
          role: claims.role,
          aal: claims.aal,
          amr: claims.amr,
          iss: claims.iss,
          exp: claims.exp,
          user_role: (claims as { user_role?: unknown }).user_role,
          app_metadata_keys: Object.keys((claims as { app_metadata?: object }).app_metadata ?? {}),
        }
      : null,
  };
}

export function authDebug(scope: string, message: string, data?: unknown): void {
  if (!AUTH_DEBUG_ENABLED) return;
  const ts = new Date().toISOString();
  console.warn(`${PREFIX} [${ts}] [${scope}] ${message}`, sanitizeDebugPayload(data) ?? '');
}

export function authDebugError(scope: string, message: string, error: unknown): void {
  if (!AUTH_DEBUG_ENABLED) return;
  const normalized =
    error instanceof Error
      ? {
          name: error.name,
          message: maskSensitiveText(error.message),
          stack: maskSensitiveText(error.stack),
        }
      : { value: error };
  const ts = new Date().toISOString();

  console.error(`${PREFIX} [${ts}] [${scope}] ${message}`, sanitizeDebugPayload(normalized));
}

/** Loga o estado bruto da URL no callback (query, hash, error params). */
export function authDebugUrl(scope: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const safeQuery: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    safeQuery[k] = k === 'code' || k.includes('token') ? maskToken(v) : v;
  });
  const safeHash: Record<string, string> = {};
  hashParams.forEach((v, k) => {
    safeHash[k] = k.includes('token') ? maskToken(v) : v;
  });
  authDebug(scope, 'url snapshot', {
    pathname: url.pathname,
    has_query: url.search.length > 0,
    has_hash: hash.length > 0,
    query: safeQuery,
    hash: safeHash,
  });
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __authDebugInternals = { maskToken, maskEmail, decodeJwtPayload };

function sanitizeDebugPayload(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return maskSensitiveText(data);
  try {
    const json = JSON.stringify(data);
    const masked = maskSensitiveText(json);
    return masked ? JSON.parse(masked) : data;
  } catch {
    return { unserializable: true };
  }
}
