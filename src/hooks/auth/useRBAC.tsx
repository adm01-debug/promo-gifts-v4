import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { logger } from '@/lib/logger';

/**
 * Hierarquia oficial: dev > supervisor > agente.
 * Os nomes legados admin/manager/seller permanecem na tabela `role_permissions`
 * por compatibilidade — mapeamos transparentemente abaixo.
 */
export type RoleName = 'dev' | 'supervisor' | 'agente';

export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
}

export interface Permission {
  action: string;
  resource: string;
}

/**
 * Mapeia permission_code do banco para o formato action/resource
 * Ex: "create_quotes" → { action: "create", resource: "quotes" }
 */
function parsePermissionCode(code: string): Permission {
  const idx = code.indexOf('_');
  if (idx === -1) return { action: code, resource: '*' };
  return {
    action: code.substring(0, idx),
    resource: code.substring(idx + 1),
  };
}

/**
 * Normaliza qualquer valor vindo do banco/auth para a hierarquia atual.
 * dev → dev | admin/supervisor → supervisor | demais → agente
 */
function normalizeRole(raw: string | null | undefined): RoleName {
  const r = (raw ?? '').toLowerCase();
  if (r === 'dev') return 'dev';
  if (r === 'supervisor' || r === 'admin' || r === 'manager') return 'supervisor';
  return 'agente';
}

/**
 * Converte a role normalizada para o nome usado em `role_permissions`
 * (mantemos os enums legados nessa tabela enquanto a migração não desce).
 */
function toDbRole(role: RoleName): 'admin' | 'manager' | 'vendedor' {
  if (role === 'dev') return 'admin'; // dev herda permissões de admin no banco
  if (role === 'supervisor') return 'manager';
  return 'vendedor';
}

/**
 * Hook de RBAC dinâmico — busca permissões da tabela role_permissions no banco.
 * dev recebe wildcard (*) sempre — é o topo da hierarquia técnica.
 */
export function useRBAC() {
  const {
    role: authRole,
    roles: authRoles,
    isLoading: authLoading,
    profile,
    user,
    isDev,
    isSupervisor,
    isSupervisorOrAbove,
    isAgente,
  } = useAuth();

  // Prioriza as roles reais do user_roles; cai no `role` único como fallback
  const roleName: RoleName = useMemo(() => {
    if (isDev) return 'dev';
    if (isSupervisor || authRoles?.includes('admin') || authRoles?.includes('supervisor')) {
      return 'supervisor';
    }
    return normalizeRole(authRole);
  }, [isDev, isSupervisor, authRoles, authRole]);

  const dbRole = toDbRole(roleName);

  /**
   * BUG-04 FIX: dev nunca consulta role_permissions — já tem wildcard hardcoded.
   *
   * PROBLEMA ORIGINAL: a query era habilitada para todos os usuários autenticados
   * (`enabled: !!user`), incluindo dev. Isso causava uma consulta desnecessária
   * ao banco e mantinha `permissionsLoading: true` transitório para admins dev,
   * podendo flickar guards de UI.
   */
  const { data: dbPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['role-permissions', dbRole],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_code')
        .eq('role', dbRole);

      if (error) {
        logger.warn('Failed to fetch role permissions, using fallback:', error.message);
        return null;
      }
      return data.map((row: { permission_code: string }) => row.permission_code);
    },
    // FIX: dev sempre tem wildcard — não precisa consultar o banco
    enabled: !!user && roleName !== 'dev',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const permissions = useMemo<Permission[]>(() => {
    // dev sempre tem wildcard — é o topo da hierarquia
    if (roleName === 'dev') {
      return [{ action: '*', resource: '*' }];
    }
    if (!dbPermissions) return [];
    return dbPermissions.map(parsePermissionCode);
  }, [roleName, dbPermissions]);

  const role: Role = {
    id: profile?.id || '',
    name: roleName,
    description: getDescriptionForRole(roleName),
  };

  const hasPermission = (action: string, resource: string): boolean => {
    return permissions.some(
      (p) =>
        (p.action === '*' || p.action === action) &&
        (p.resource === '*' || p.resource === resource),
    );
  };

  const hasPermissionByCode = (code: string): boolean => {
    if (roleName === 'dev') return true;
    return dbPermissions?.includes(code) ?? false;
  };

  const hasRole = (...roles: RoleName[]): boolean => roles.includes(roleName);

  /**
   * Aplica `requiredRole` respeitando hierarquia:
   *  - 'dev' → apenas dev
   *  - 'supervisor' → supervisor ou dev
   *  - 'agente' → todos os autenticados
   */
  const meetsRequiredRole = (required: RoleName): boolean => {
    if (required === 'dev') return roleName === 'dev';
    if (required === 'supervisor') return roleName === 'dev' || roleName === 'supervisor';
    return true;
  };

  const getPermissions = (): Permission[] => permissions;

  return {
    role,
    // FIX: dev nunca terá permissionsLoading=true (query desabilitada)
    isLoading: authLoading || (roleName !== 'dev' && permissionsLoading),
    hasPermission,
    hasPermissionByCode,
    hasRole,
    meetsRequiredRole,
    // Helpers da hierarquia atual
    isDev,
    isSupervisor,
    isSupervisorOrAbove,
    isAgente,
    // Aliases legados — preferir os helpers acima
    isAdmin: isSupervisorOrAbove,
    isManagerOrAbove: isSupervisorOrAbove,
    getPermissions,
  };
}

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  dev: 'Desenvolvedor',
  supervisor: 'Supervisor',
  agente: 'Agente',
} as const;

function getDescriptionForRole(role: RoleName): string {
  return ROLE_DESCRIPTIONS[role] || 'Agente';
}

export default useRBAC;
