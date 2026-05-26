/**
 * SSOT — Rotas técnicas que só devem ser navegáveis por papel `dev`.
 *
 * Usado por:
 *  - Sidebar (já filtra por `devOnly` declarativo).
 *  - Breadcrumbs (esconde links técnicos para não-dev).
 *  - Command palettes / quick links que disparem navegação programática.
 *
 * IMPORTANTE: este helper é defesa-em-profundidade da UI. A autorização
 * real continua nas RLS policies + `DevRoute` no roteador.
 */

/** Prefixos de rota considerados "técnicas" (devOnly). */
export const DEV_ONLY_ROUTE_PREFIXES = [
  '/admin/telemetria',
  '/admin/conexoes',
  '/admin/seguranca',
  '/admin/seguranca-acesso',
  '/admin/workflows',
  '/admin/prompts-ia',
  '/admin/validade-precos',
  '/admin/rate-limit',
  '/admin/login-attempts',
  '/admin/status',
  '/admin/rbac-rotas',
  '/admin/qa',
] as const;

/** Prefixos `/admin/*` administrativos (não técnicos) — exigem `admin` ou `dev`. */
export const ADMIN_ONLY_ROUTE_PREFIXES = ['/admin/usuarios', '/admin/cadastros'] as const;

export function isDevOnlyPath(pathname: string): boolean {
  return DEV_ONLY_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminOnlyPath(pathname: string): boolean {
  if (isDevOnlyPath(pathname)) return true;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  return ADMIN_ONLY_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Decide se um link/segmento de breadcrumb deve ser **navegável** para o
 * usuário atual. Retorna `false` para esconder o `href` (vira texto).
 */
export function canNavigateTo(
  pathname: string,
  opts: { isDev: boolean; isAdmin: boolean },
): boolean {
  if (isDevOnlyPath(pathname)) return opts.isDev;
  if (isAdminOnlyPath(pathname)) return opts.isAdmin || opts.isDev;
  return true;
}
