/**
 * Filtro central para esconder itens de palettes/buscas globais que
 * apontem para rotas restritas (admin/dev) quando o usuário não tem o
 * papel necessário.
 *
 * Reusa o SSOT em `src/lib/navigation/restricted-routes.ts` — qualquer
 * rota que apareça lá será automaticamente filtrada nos comandos.
 *
 * Uso:
 *   const visible = filterByRoutePermission(items, (i) => i.path, roles);
 */
import { canNavigateTo, isDevOnlyPath, isAdminOnlyPath } from '@/lib/navigation/restricted-routes';

export interface RouteAccessRoles {
  isDev: boolean;
  isAdmin: boolean;
}

/**
 * Mantém o item se: (a) não há path associado (ações puramente locais
 * — toggle de tema, abrir ajuda etc.) OU (b) o usuário pode navegar.
 */
export function filterByRoutePermission<T>(
  items: readonly T[],
  getPath: (item: T) => string | null | undefined,
  roles: RouteAccessRoles,
): T[] {
  return items.filter((item) => {
    const path = getPath(item);
    if (!path) return true;
    return canNavigateTo(path, roles);
  });
}

/** Útil para diagnósticos / testes. */
export function isRestrictedPath(path: string): boolean {
  return isDevOnlyPath(path) || isAdminOnlyPath(path);
}
