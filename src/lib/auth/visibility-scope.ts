/**
 * visibility-scope — determina o escopo de visibilidade de dados de vendas
 * para o usuário autenticado, com base nos papéis (user_roles).
 *
 * - "all"    → admin, manager, dev (vê tudo)
 * - "team"   → supervisor (vê dados do time / mesma organização)
 * - "self"   → vendedor (vê apenas os próprios dados)
 *
 * O isolamento real é feito por RLS no banco; este helper serve para a UI
 * decidir se aplica filtros adicionais por seller_id e para exibir o
 * badge "Apenas seus dados".
 */
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type SalesScope = 'all' | 'self' | 'team';

export function useSalesScope(): SalesScope {
  const { role, isDev, isSupervisorOrAbove } = useAuth();
  return useMemo<SalesScope>(() => {
    if (isDev || role === 'admin' || role === 'manager') return 'all';
    if (isSupervisorOrAbove || role === 'supervisor') return 'team';
    return 'self';
  }, [role, isDev, isSupervisorOrAbove]);
}

export function isOnlySelf(scope: SalesScope): boolean {
  return scope === 'self';
}
