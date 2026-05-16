import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { consumePostLoginRedirect } from '@/lib/auth/post-login-redirect';
import { resolveRedirectTarget } from '@/lib/auth/resolve-redirect-target';
import { resolveOAuthError, type OAuthErrorCopy } from '@/lib/auth/oauth-error-messages';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  Loader2,
  Gift,
  Mail,
  Lock,
  ShieldAlert,
  Globe,
  Wifi,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { AuthBrandingPanel, Starfield } from './auth/AuthBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useIPValidation } from '@/hooks/useIPValidation';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { supabase } from '@/integrations/supabase/client';
import { AppLogo } from '@/components/layout/AppLogo';
import { loginSchema, type LoginFormData } from '@/lib/validations';

type LoginForm = LoginFormData;

// ContinuousRockets and AuthBrandingPanel extracted to ./auth/AuthBranding.tsx

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const { validateIPForAuthenticatedUser, logLoginAttempt } = useIPValidation();

  /**
   * Destino pós-login. Precedência:
   *  1. `location.state.from` (vindo do ProtectedRoute na mesma aba)
   *  2. `?redirect=/path` na URL (deep-link manual)
   *  3. `sessionStorage` (sobrevive ao round-trip OAuth)
   *  4. fallback `/`
   * Consumido aqui para que login por e-mail/senha também respeite o destino.
   */
  const resolveRedirectTargetCb = useCallback((): string => {
    const fromState = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)
      ?.from;
    return resolveRedirectTarget({
      fromState: fromState ?? null,
      queryRedirect: searchParams.get('redirect'),
    });
  }, [location.state, searchParams]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success'>('idle');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockedIP, setBlockedIP] = useState<string | null>(null);
  const [currentIP, setCurrentIP] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<string | null>(null);
  // Fallback social → email/senha: mensagem amigável quando OAuth falha.
  const [socialError, setSocialError] = useState<OAuthErrorCopy | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  // Função `retry` publicada pelo SocialLoginButtons para reexecutar o Google login.
  const googleRetryRef = useRef<(() => void) | null>(null);
  const handleRetryGoogle = useCallback(() => {
    setSocialError(null);
    googleRetryRef.current?.();
  }, []);

  // Captura `?error=` vindo do SSOCallbackPage (Google falhou) e exibe o
  // banner de fallback com mensagem descritiva. Limpa o param da URL.
  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      setSocialError(resolveOAuthError(err));
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const focusEmailFallback = useCallback(() => {
    emailInputRef.current?.focus();
    emailInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleSocialError = useCallback(
    (message: string, opts?: { autoFallback?: boolean }) => {
      const copy = resolveOAuthError(message);
      setSocialError(copy);
      // Fallback automático em falhas recuperáveis (timeout/silencioso):
      // o usuário não precisa clicar — o foco vai direto pro e-mail.
      if (opts?.autoFallback && !copy.isConfig) {
        toast({
          title: 'Login com Google indisponível',
          description: 'Mudamos para entrada com e-mail e senha automaticamente.',
        });
        setTimeout(() => focusEmailFallback(), 50);
        return;
      }
      setTimeout(() => emailInputRef.current?.focus(), 50);
    },
    [toast, focusEmailFallback],
  );

  // Fetch IP and geolocation via edge function (works in preview + production)
  useEffect(() => {
    const loadIPInfo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-visitor-info');
        if (!error && data) {
          if (data.ip) setCurrentIP(data.ip);
          if (data.city) setGeoLocation(`${data.city}, ${data.country_code}`);
        }
      } catch {
        // silent fail
      }
    };
    loadIPInfo();
  }, []);

  // Redirect if already logged in (only on initial load)
  useEffect(() => {
    if (user && !authLoading && !isSubmitting) {
      navigate(resolveRedirectTargetCb(), { replace: true });
    }
  }, [user, authLoading, navigate, isSubmitting, resolveRedirectTargetCb]);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const validateAndRedirect = async (userId: string, email: string) => {
    try {
      const ipValidation = await validateIPForAuthenticatedUser(userId);

      if (!ipValidation.isAllowed && ipValidation.hasRestrictions) {
        await signOut();
        const reason = ipValidation.reason || 'access_blocked';
        await logLoginAttempt(email, userId, false, `${reason}: ${ipValidation.error}`);

        setIpBlocked(true);
        setBlockedIP(ipValidation.currentIP);

        toast({
          variant: 'destructive',
          title: 'Acesso Bloqueado',
          description:
            ipValidation.error || `Seu IP (${ipValidation.currentIP}) não está autorizado.`,
          duration: 10000,
        });
        return false;
      }

      await logLoginAttempt(email, userId, true);

      setLoginStatus('success');
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });

      // Aguarda o feedback visual de sucesso antes de navegar
      setTimeout(() => {
        navigate(resolveRedirectTargetCb(), { replace: true });
      }, 600);
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      navigate(resolveRedirectTargetCb(), { replace: true }); // Fail-open
      return true;
    }
  };

  const handleLogin = async (data: LoginForm) => {
    setIsSubmitting(true);
    setIpBlocked(false);

    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        await logLoginAttempt(data.email, null, false, error.message);

        const description = error.message.includes('Invalid login credentials')
          ? 'Email ou senha incorretos'
          : error.message;

        toast({
          variant: 'destructive',
          title: 'Erro ao entrar',
          description,
        });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (userId) {
        await validateAndRedirect(userId, data.email);
      } else {
        navigate(resolveRedirectTargetCb());
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background"
        role="main"
        aria-label="Carregando autenticação"
      >
        <Loader2 className="h-8 w-8 animate-spin text-orange" />
      </main>
    );
  }

  if (user && !authLoading && !isSubmitting) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0D14] text-white">
        <Starfield />
        <div className="z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <AppLogo showText={false} iconClassName="h-20 w-20 rounded-2xl shadow-orange/40 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success flex items-center justify-center ring-4 ring-[#0A0D14]">
              <RotateCw className="h-3 w-3 text-white animate-spin-slow" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-bold">Você já está conectado</h2>
            <p className="text-white/60 text-sm">Redirecionando para sua área segura...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative flex min-h-screen overflow-hidden bg-[#0A0D14]"
      role="main"
      aria-label="Autenticação"
    >
      {/* Fundo unificado azul-escuro com estrelas cobrindo TODA a tela */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <Starfield />
      </div>

      <PageSEO
        title="Login"
        description="Acesse a plataforma Promo Gifts. Faça login para gerenciar seus orçamentos e catálogo."
        path="/login"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Login — Promo Gifts',
          description: 'Página de autenticação da plataforma Promo Gifts.',
          url: 'https://criar-together-now.lovable.app/login',
        }}
      />
      {/* Left side - Branding */}
      <AuthBrandingPanel />


      {/* Right side - Auth Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-in space-y-8">
          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden">
            <AppLogo />
          </div>

          {/* IP Blocked Alert */}
          {ipBlocked && (
            <Card className="border-destructive/40 bg-destructive/10 shadow-lg backdrop-blur-xl">
              <CardContent className="pb-6 pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-destructive/20">
                    <ShieldAlert className="h-6 w-6 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold text-destructive">
                      Acesso Bloqueado
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Seu endereço IP (
                      <span className="font-mono font-semibold text-foreground">{blockedIP}</span>)
                      não está autorizado a acessar esta conta.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato com o administrador do sistema para liberar seu acesso.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setIpBlocked(false);
                        setBlockedIP(null);
                      }}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auth Card */}
          <Card
            className={`border-white/20 bg-[#0A0D14]/75 shadow-2xl shadow-black/40 backdrop-blur-xl ${ipBlocked ? 'pointer-events-none opacity-50' : ''}`}
          >
            {showForgotPassword ? (
              <CardContent className="pb-6 pt-6">
                <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-4">
                  <div className="space-y-1 text-center">
                    <h1 className="font-display text-xl font-semibold text-foreground">
                      Bem-vindo de volta
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Entre com suas credenciais para continuar
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-2">
                  {socialError && (
                    <div
                      role="alert"
                      data-testid="social-login-fallback-banner"
                      className="animate-fade-in space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <p className="font-semibold leading-tight text-amber-900 dark:text-amber-200" data-testid="social-login-error-title">
                            {socialError.title}
                          </p>
                          <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/80" data-testid="social-login-error-description">
                            {socialError.description}
                          </p>
                          {socialError.hint && (
                            <div className="rounded-md bg-amber-500/10 p-2 border border-amber-500/20" data-testid="social-login-error-hint">
                              <p className="text-[11px] leading-snug text-amber-900/90 dark:text-amber-100/90">
                                <span className="font-bold uppercase tracking-wider text-[9px] opacity-70 mr-1">Dica:</span>
                                {socialError.hint}
                              </p>
                            </div>
                          )}
                          {socialError.isConfig && (
                            <p className="text-[10px] italic text-amber-700/70 dark:text-amber-400/60">
                              Este é um problema de configuração que requer atenção do administrador.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/10">
                        {!socialError.isConfig && (
                          <Button
                            type="button"
                            size="sm"
                            variant="orange"
                            className="h-8 gap-1.5 text-xs font-medium shadow-sm hover:shadow-md transition-all active:scale-95"
                            onClick={handleRetryGoogle}
                            data-testid="social-fallback-retry-google"
                          >
                            <RotateCw className="h-3 w-3" aria-hidden="true" />
                            Tentar novamente
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={socialError.isConfig ? 'orange' : 'outline'}
                          className={`h-8 text-xs font-medium transition-all active:scale-95 ${!socialError.isConfig ? 'border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-900' : 'shadow-sm'}`}
                          onClick={focusEmailFallback}
                          data-testid="social-fallback-use-email"
                        >
                          Usar e-mail e senha
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-amber-800/60 hover:text-amber-900 hover:bg-transparent"
                          onClick={() => setSocialError(null)}
                        >
                          Dispensar
                        </Button>
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={loginForm.handleSubmit(handleLogin)}
                    className="space-y-4"
                    data-testid="login-form"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-foreground">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-email"
                          data-testid="login-email-input"
                          type="email"
                          placeholder="seu@email.com"
                          autoComplete="email"
                          className="border-border bg-input pl-10 focus:border-orange focus:ring-orange"
                          {...loginForm.register('email')}
                          ref={(el) => {
                            loginForm.register('email').ref(el);
                            emailInputRef.current = el;
                          }}
                        />
                      </div>
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive" data-testid="login-error-msg">
                          {loginForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-foreground">
                        Senha
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          data-testid="login-password-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="border-border bg-input pl-10 pr-10 focus:border-orange focus:ring-orange"
                          {...loginForm.register('password')}
                        />
                        <button
                          type="button"
                          data-testid="login-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -mr-2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-orange"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        data-testid="login-forgot-link"
                        variant="link-primary"
                        className="h-auto p-0 text-sm"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Esqueci minha senha
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      data-testid="login-submit"
                      variant="orange"
                      className="h-12 w-full text-base font-semibold shadow-lg shadow-orange/25 transition-all duration-300 hover:shadow-xl hover:shadow-orange/30"
                        disabled={isSubmitting || loginStatus === 'success'}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Entrando...
                          </>
                        ) : loginStatus === 'success' ? (
                          <>
                            <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                              <Gift className="h-4 w-4" />
                              <span>Pronto!</span>
                            </div>
                          </>
                        ) : (
                          'Entrar'
                        )}
                      </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#0A0D14]/75 px-2 text-muted-foreground backdrop-blur-xl">
                          ou
                        </span>
                      </div>
                    </div>

                    <SocialLoginButtons onError={handleSocialError} retryRef={googleRetryRef} />
                  </form>
                </CardContent>
              </>
            )}
          </Card>

          {/* IP/Location Widget */}
          {currentIP && (
            <div
              className="mx-auto flex max-w-fit items-center justify-center gap-3 rounded-full border border-border/60 bg-card/80 px-5 py-2.5 opacity-0 shadow-md backdrop-blur-md"
              style={{ animation: 'scale-fade-in 0.5s ease-out 600ms forwards' }}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 text-orange" />
                <span className="font-mono">{currentIP}</span>
              </div>
              {geoLocation && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5 text-success" />
                    <span>{geoLocation}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Acesso restrito a usuários autorizados.
            <br />
            Contate o administrador para obter suas credenciais.
          </p>
        </div>
      </div>
    </main>
  );
}
