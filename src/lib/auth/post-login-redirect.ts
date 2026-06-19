/**
 * Persistência do destino pós-login.
 *
 * Usado quando o usuário tenta acessar uma rota privada sem sessão
 * (ProtectedRoute) ou quando faz login social (OAuth round-trip perde o
 * `location.state`). Guardamos em `sessionStorage` o caminho desejado e
 * consumimos depois do login.
 *
 * Regras de segurança:
 *  - Só aceita caminhos internos (começando com `/`, sem `//` ou esquema).
 *  - Rotas de autenticação são rejeitadas para evitar loop.
 *  - Valor é one-shot: consumir já remove.
 */

const KEY = 'auth:post_login_redirect';

/**
 * Rotas de autenticação — NUNCA podem ser destino pós-login (geram loop).
 * Exportado para defesa-em-profundidade em `resolveRedirectTarget`.
 */
export const AUTH_BLOCKED_PREFIXES = [
  '/auth',
  '/login',
  '/logout',
  '/signup',
  '/sign-up',
  '/register',
  '/reset-password',
  '/forgot-password',
  '/unauthorized',
] as const;
// Nota: '/auth' cobre '/auth/callback' automaticamente via startsWith.

/**
 * Decodifica até 5 níveis de URL-encoding para frustrar bypass com
 * `%2Fauth`, `%252Fauth`, `%25252Fauth`, etc. Retorna a string original se decode falhar.
 * 5 iterations covers triple-encoding (%25252F → %252F → %2F → /) plus margin.
 */
function safeDecode(path: string): string {
  let current = path;
  for (let i = 0; i < 5; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

/** True se o path (já decodificado) aponta para uma rota de autenticação. */
export function isAuthRoutePath(path: string): boolean {
  const lower = path.toLowerCase();
  return AUTH_BLOCKED_PREFIXES.some(
    (p) =>
      lower === p ||
      lower.startsWith(`${p}/`) ||
      lower.startsWith(`${p}?`) ||
      lower.startsWith(`${p}#`),
  );
}

/** Valida se um path é seguro para redirect interno. */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  // Deve começar com `/` mas não `//` (protocol-relative) nem `/\` (Windows-style)
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  // Rejeita esquemas embutidos (ex.: `javascript:`, `data:`)
  if (/^[a-z]+:/i.test(path)) return false;

  // Defesa-em-profundidade: decodifica URL-encoding antes de checar auth-routes.
  const decoded = safeDecode(path);
  // Após decode, re-valida prefixos perigosos (ex.: `/%2F..` → `//..`)
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return false;
  if (/^[a-z]+:/i.test(decoded)) return false;
  if (isAuthRoutePath(decoded)) return false;
  // Também checa a forma crua, caso o decode tenha falhado por algum motivo
  if (isAuthRoutePath(path)) return false;

  return true;
}

/** Salva o destino pós-login. No-op se inválido ou sessionStorage indisponível. */
export function savePostLoginRedirect(path: string): void {
  if (!isSafeRedirectPath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // sessionStorage pode estar indisponível (modo privado, SSR, etc.)
  }
}

/** Lê (sem remover) o destino pós-login. */
export function peekPostLoginRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v && isSafeRedirectPath(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Consome (lê e remove) o destino pós-login.
 * Retorna o fallback se nada estiver salvo ou se for inválido.
 */
export function consumePostLoginRedirect(fallback = '/'): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v && isSafeRedirectPath(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Limpa o destino pós-login. */
export function clearPostLoginRedirect(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
