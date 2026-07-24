import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { ShieldAlert, LogIn, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { generateSecurityId } from '@/lib/access/security-utils';

type UnauthorizedState = { from?: Location } | null;

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Origem que disparou o bloqueio (vinda de um guard via navigate state).
  // Se não houver, preservamos o próprio /unauthorized apenas como referência —
  // o Auth.tsx irá decidir o destino final via consumePostLoginRedirect.
  const fromLocation = (location.state as UnauthorizedState)?.from ?? location;

  // Ofusca o path original para segurança usando hash não reversível
  const requestId = useMemo(
    () => generateSecurityId('AUTH', fromLocation.pathname ?? location.pathname),
    [fromLocation.pathname, location.pathname],
  );

  const handleRetryLogin = () => {
    navigate('/auth', { state: { from: fromLocation }, replace: true });
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>401 — Autenticação Necessária</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div
        role="alert"
        data-testid="app-unauthorized"
        className="flex min-h-screen items-center justify-center bg-background px-4 py-8"
      >
        <div className="flex w-full max-w-md animate-fade-in flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/10 blur-xl" />
            <ShieldAlert className="relative z-10 h-16 w-16 text-primary" />
          </div>

          <div className="space-y-2">
            <span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              Não Autenticado · 401
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Acesso Restrito</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Para visualizar este conteúdo, você precisa estar autenticado. Sua sessão pode ter
              expirado, ou o link acessado é protegido por permissões adicionais.
            </p>
            <p className="text-xs text-muted-foreground/80">
              Tente entrar novamente — você será redirecionado de volta após o login.
            </p>
          </div>

          <div className="w-full space-y-2 border-t border-border/40 pt-4">
            <Button
              onClick={handleRetryLogin}
              className="h-9 w-full gap-2"
              data-testid="unauthorized-retry-login"
            >
              <LogIn className="h-4 w-4" />
              Tentar login novamente
            </Button>

            <Button
              variant="outline"
              onClick={handleGoHome}
              className="h-9 w-full gap-2"
              data-testid="unauthorized-go-home"
            >
              <Home className="h-4 w-4" />
              Voltar para a Home
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="h-9 w-full gap-2"
              data-testid="unauthorized-go-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar à página anterior
            </Button>
          </div>

          <div className="pt-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
              Identificador de Segurança
            </p>
            <p className="mt-1 inline-block rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground/60">
              {requestId}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
