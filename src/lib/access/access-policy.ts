import { type AppRole } from '@/contexts/AuthContext';

export interface AccessPolicy {
  requiredRole?: AppRole;
  requireMfa?: boolean;
  requireDev?: boolean;
}

export const checkAccess = (
  userRoles: AppRole[] | null | undefined,
  currentAAL: string | null,
  policy: AccessPolicy,
): { allowed: boolean; reason?: 'insufficient_role' | 'mfa_required' | 'unauthenticated' } => {
  const { requiredRole, requireMfa, requireDev } = policy;
  // Defensivo contra mocks parciais e estados intermediários do AuthContext
  // (carregando, falha de fetch). Em runtime real AuthContext sempre retorna
  // [], mas null/undefined pode aparecer em testes ou em frames iniciais.
  const safeRoles: AppRole[] = Array.isArray(userRoles) ? userRoles : [];

  if (requireDev && !safeRoles.includes('dev')) {
    return { allowed: false, reason: 'insufficient_role' };
  }

  if (requiredRole) {
    const isSupervisorOrAbove = safeRoles.some((r) =>
      ['dev', 'supervisor', 'admin', 'manager'].includes(r),
    );
    if (requiredRole === 'dev') {
      if (!safeRoles.includes('dev')) {
        return { allowed: false, reason: 'insufficient_role' };
      }
    } else if (
      requiredRole === 'supervisor' ||
      requiredRole === 'admin' ||
      requiredRole === 'manager'
    ) {
      // Papéis de gestão exigem supervisor-ou-acima.
      if (!isSupervisorOrAbove) {
        return { allowed: false, reason: 'insufficient_role' };
      }
    } else if (!safeRoles.includes(requiredRole)) {
      // Default-deny: qualquer outro papel exigido (ex.: 'agente') requer o papel
      // exato. Antes, valores não tratados caíam em `allowed: true` (fail-open).
      return { allowed: false, reason: 'insufficient_role' };
    }
  }

  if (requireMfa && currentAAL !== 'aal2') {
    return { allowed: false, reason: 'mfa_required' };
  }

  return { allowed: true };
};
