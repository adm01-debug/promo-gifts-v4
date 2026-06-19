import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logAccessDenied } from '@/lib/access/log-access-denied';
import { DevAccessDeniedPage } from '@/components/access/DevAccessDeniedPage';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const MfaEnrollmentDialog = lazyWithRetry(() =>
  import('@/components/security/MfaEnrollmentDialog').then((m) => ({
    default: m.MfaEnrollmentDialog,
  })),
);
const MfaChallengeDialog = lazyWithRetry(() =>
  import('@/components/security/MfaChallengeDialog').then((m) => ({
    default: m.MfaChallengeDialog,
  })),
);

function DialogFallback() {
  return null;
}

interface DevRouteProps {
  children?: ReactNode;
}

/**
 * Guarda para rotas técnicas restritas ao papel `dev`.
 *
 * Cobre telemetria, conexões externas, secrets, audit técnico, MCP,
 * rate-limit, login-attempts, external-db, status do sistema.
 *
 * Hierarquia: dev > supervisor > agente. Apenas `dev` passa.
 *
 * Hardening (paridade com AdminRoute): exige sessão em **AAL2** para `dev`.
 *  - Dev sem MFA cadastrado → abre fluxo de enrollment obrigatório.
 *  - Dev com MFA mas sessão em `aal1` → abre challenge para elevar sessão.
 *  - Não-dev nunca chega na exigência de MFA aqui — vê a tela de bloqueio
 *    com ações contextuais (solicitar acesso, copiar link, e-mail).
 *
 * Comportamento ao bloquear:
 *  - Não autenticado → redireciona para /auth preservando `from`.
 *  - Autenticado sem `dev` → exibe tela de aviso com:
 *      • CTA "Solicitar acesso a Dev" (notificação pessoal + mailto).
 *      • CTA "Copiar link da página" para encaminhar manualmente.
 *      • Retorno para destino seguro (supervisor → /admin/usuarios, agente → /).
 */
export function DevRoute({ children }: DevRouteProps) {
  const { user, isDev, isLoading, currentAAL, hasMFA, mfaRequired, role } = useAuth();
  const location = useLocation();
  const [enrollOpen, setEnrollOpen] = useState(false);

  const blockedPath = location.pathname;
  // Snapshot da rota bloqueada (path + search + hash + state) capturado na
  // primeira renderização, para que "Tentar novamente" preserve o location
  // state original mesmo após re-renders ou depois de abrir/fechar diálogos.
  const [blockedTarget] = useState(() => ({
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state,
  }));
  const blockedFullPath = `${blockedTarget.pathname}${blockedTarget.search}${blockedTarget.hash}`;

  // Abre enrollment automaticamente para dev sem MFA cadastrado.
  useEffect(() => {
    if (!isLoading && user && isDev && !hasMFA) {
      setEnrollOpen(true);
    }
  }, [isLoading, user, isDev, hasMFA]);

  // Toast informativo ao bloquear — coalescido por janela de 60s/usuário
  // para não disparar repetidamente quando o usuário navega entre rotas
  // técnicas (ex.: /telemetria → /conexoes → /seguranca). O `id` estável
  // já evita empilhamento dentro da mesma sessão de Sonner; a janela em
  // sessionStorage cobre o caso de remontagem por mudança de rota.
  useEffect(() => {
    if (isLoading || !user || isDev) return;

    const TOAST_ID = 'dev-route-blocked';
    const STORAGE_KEY = `dev-route-toast:${user.id}`;
    const WINDOW_MS = 60_000;
    let shouldShow = true;
    try {
      const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? '0');
      if (last && Date.now() - last < WINDOW_MS) shouldShow = false;
      else sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // sessionStorage indisponível (modo privado etc.) — segue mostrando.
    }

    if (shouldShow) {
      toast.error('Acesso restrito', {
        id: TOAST_ID,
        description: 'Área exclusiva da equipe técnica.',
        duration: 4000,
      });
    }

    void logAccessDenied({
      userId: user.id,
      blockedPath,
      requiredRole: 'dev',
      userRole: role,
    });
  }, [isLoading, user, isDev, blockedPath, role]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Hardening MFA/AAL2 — só aplicável a usuários `dev` (que efetivamente passariam).
  // Não-dev segue para a tela de bloqueio com ações contextuais (sem pedir MFA).
  if (isDev && !hasMFA) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Suspense fallback={<DialogFallback />}>
          <MfaEnrollmentDialog open={enrollOpen} onOpenChange={setEnrollOpen} enforce />
        </Suspense>
      </>
    );
  }

  if (isDev && hasMFA && mfaRequired && currentAAL !== 'aal2') {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Suspense fallback={<DialogFallback />}>
          <MfaChallengeDialog open />
        </Suspense>
      </>
    );
  }

  if (!isDev) {
    return (
      <DevAccessDeniedPage
        user={{ id: user.id, email: user.email }}
        role={role}
        blockedPath={blockedPath}
        blockedFullPath={blockedFullPath}
        blockedState={blockedTarget.state}
      />
    );
  }

  // Retorno único: Outlet (Layout Route) ou children. Sem forwardRef:
  // Router não passa refs para `element={<DevRoute />}`.
  return children ? <>{children}</> : <Outlet />;
}
