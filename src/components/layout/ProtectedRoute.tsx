import { type ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedErrorBoundary } from '@/components/errors/EnhancedErrorBoundary';
import { EmptyState } from '@/components/common/EmptyState';
import { checkAccess, type AccessPolicy } from '@/lib/access/access-policy';
import { savePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { createClientLogger } from '@/lib/telemetry/structuredLogger';

interface ProtectedRouteProps extends AccessPolicy {
  children?: ReactNode;
  /** @deprecated Use requiredRole="supervisor" */
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireMfa,
  requireDev,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, roles, currentAAL, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar transition-colors duration-500">
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Salva destino pós-login (sobrevive ao round-trip OAuth)
    savePostLoginRedirect(`${location.pathname}${location.search}${location.hash}`);
    // Etapa 8: instrumentação para auditar se Navigate está mudando URL em produção
    createClientLogger('auth.protected_route').info('redirect_to_auth', {
      from: location.pathname,
    });
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const effectiveRole =
    requiredRole || (requireDev ? 'dev' : requireAdmin ? 'supervisor' : undefined);
  const { allowed, reason } = checkAccess(roles, currentAAL, {
    requiredRole: effectiveRole,
    requireMfa,
    requireDev,
  });

  if (!allowed) {
    if (reason === 'mfa_required') {
      // O AdminRoute/DevRoute tratam o diálogo de MFA, aqui apenas bloqueamos se for o caso
      // mas o ProtectedRoute genérico geralmente não exige MFA a menos que passado explicitamente
    }

    return (
      <EmptyState
        variant="security"
        title="Acesso Restrito"
        description={
          reason === 'insufficient_role'
            ? 'Você não tem permissão para acessar esta área.'
            : 'Autenticação adicional necessária.'
        }
        action={{ label: 'Voltar ao início', onClick: () => (window.location.href = '/') }}
      />
    );
  }

  return (
    <EnhancedErrorBoundary
      fallback={
        <div className="p-8">
          <EmptyState
            variant="error"
            title="Falha no Módulo"
            description="Ocorreu um erro ao carregar esta seção. Tente recarregar a página."
            action={{ label: 'Recarregar', onClick: () => window.location.reload() }}
          />
        </div>
      }
    >
      {children ? <>{children}</> : <Outlet />}
    </EnhancedErrorBoundary>
  );
}
