import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

/**
 * useRBAC — Hook central de permissões baseadas em roles (Role-Based Access Control)
 * Encapsula a lógica de hierarquia e permissões específicas.
 */
export function useRBAC() {
  const { roles, role: highestRole, isDev, isAdmin, isManager, isSupervisor, isAgente, isSeller } = useAuth();

  const permissions = useMemo(() => {
    const canAccessAdmin = isAdmin || isDev;
    const canManageUsers = isAdmin || isDev;
    const canViewTelemetry = isDev;
    const canExecuteMcp = isDev;
    const canManageProducts = isAdmin || isDev || isManager;
    const canViewDetailedStock = isAdmin || isDev || isManager || isSupervisor;
    const canApproveDiscounts = isAdmin || isDev || isManager || isSupervisor;
    
    return {
      canAccessAdmin,
      canManageUsers,
      canViewTelemetry,
      canExecuteMcp,
      canManageProducts,
      canViewDetailedStock,
      canApproveDiscounts,
    };
  }, [isAdmin, isDev, isManager, isSupervisor]);

  return {
    roles,
    highestRole,
    isDev,
    isAdmin,
    isManager,
    isSupervisor,
    isAgente,
    isSeller,
    ...permissions
  };
}
