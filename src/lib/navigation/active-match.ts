/**
 * SSOT for sidebar / navigation "active" matching.
 *
 * Rules:
 * - Root href "/" only matches the exact pathname "/" (otherwise it would
 *   match every route).
 * - When `exact` is true, only an exact pathname match counts as active.
 * - Otherwise, the item is active when the current pathname equals the href
 *   OR is a child route (`href` followed by `/`). This avoids false positives
 *   like "/orcamentos" matching "/orcamentos-publicos".
 */
export function isNavItemActive(pathname: string, href: string, exact?: boolean): boolean {
  if (!href) return false;
  if (href === '/' || exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith('/') ? href : `${href}/`);
}
