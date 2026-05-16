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

const BLOCKED_PREFIXES = ['/login', '/auth/callback', '/reset-password', '/unauthorized'];

/** Valida se um path é seguro para redirect interno. */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0) return false;
  // Deve começar com `/` mas não `//` (protocol-relative) nem `/\` (Windows-style)
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return false;
  // Rejeita esquemas embutidos
  if (/^[a-z]+:/i.test(path)) return false;
  // Rejeita rotas de auth (evita loop)
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) {
    return false;
  }
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
