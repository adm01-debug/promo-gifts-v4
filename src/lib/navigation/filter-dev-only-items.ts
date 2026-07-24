/**
 * Filtro puro para itens de navegação marcados com `devOnly` / `adminOnly`.
 *
 * Espelha a lógica usada em `SidebarNavGroup.renderNavLink` e
 * `SidebarReorganized` (filtro de grupos), permitindo testes unitários
 * sem montar o componente React.
 *
 * Regras (ordenadas):
 *  1. `devOnly: true`           → visível somente para `isDev`.
 *  2. `adminOnly: true`         → visível somente para `isAdmin` (ou `isDev`).
 *  3. SSOT por path (defesa)    → se o `href` cair em `isDevOnlyPath` o item
 *                                  só é visível para `isDev`, mesmo se a flag
 *                                  declarativa estiver ausente ou errada.
 *                                  Idem para `isAdminOnlyPath` x `isAdmin`.
 *  4. Sem flag e path comum     → visível para todos os autenticados.
 *
 * Importante: supervisor (`isAdmin=true, isDev=false`) NUNCA enxerga itens
 * técnicos — nem por flag, nem por path no SSOT.
 */
import { isDevOnlyPath, isAdminOnlyPath } from '@/lib/navigation/restricted-routes';

export interface NavFlagItem {
  devOnly?: boolean;
  adminOnly?: boolean;
  /** Opcional — quando presente, ativa o check defensivo via SSOT. */
  href?: string | null;
}

export interface NavRoles {
  isDev: boolean;
  isAdmin: boolean;
}

export function isItemVisibleForRoles<T extends NavFlagItem>(item: T, roles: NavRoles): boolean {
  if (item.devOnly && !roles.isDev) return false;
  if (item.adminOnly && !roles.isAdmin) return false;
  if (item.href && isDevOnlyPath(item.href) && !roles.isDev) return false;
  if (item.href && isAdminOnlyPath(item.href) && !roles.isAdmin) return false;
  return true;
}

export function filterDevOnlyItems<T extends NavFlagItem>(
  items: readonly T[],
  roles: NavRoles,
): T[] {
  return items.filter((item) => isItemVisibleForRoles(item, roles));
}
