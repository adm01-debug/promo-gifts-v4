import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { consumePostLoginRedirect } from '@/lib/auth/post-login-redirect';
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
  const resolveRedirectTarget = useCallback((): string => {
    const fromState = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)
      ?.from;
    if (fromState?.pathname) {
      const path = `${fromState.pathname}${fromState.search ?? ''}${fromState.hash ?? ''}`;
      return consumePostLoginRedirect(path);
    }
    const queryRedirect = searchParams.get('redirect');
    return consumePostLoginRedirect(queryRedirect ?? '/');
  }, [location.state, searchParams]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [ipBlocked, setIpBlocked] = useState(false);
  const [blockedIP, setBlockedIP] = useState<string | null>(null);
  const [currentIP, setCurrentIP] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<string | null>(null);
  // Fallback social → email/senha: mensagem amigável quando OAuth falha.
  const [socialError, setSocialError] = useState<OAuthErrorCopy | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleSocialError = useCallback((message: string) => {
    setSocialError(resolveOAuthError(message));
    setTimeout(() => emailInputRef.current?.focus(), 50);
  }, []);

  const focusEmailFallback = useCallback(() => {
    emailInputRef.current?.focus();
    emailInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
      navigate(resolveRedirectTarget(), { replace: true });
    }
  }, [user, authLoading, navigate, isSubmitting, resolveRedirectTarget]);

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

      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });

      navigate(resolveRedirectTarget(), { replace: true });
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      navigate(resolveRedirectTarget(), { replace: true }); // Fail-open
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
        navigate(resolveRedirectTarget());
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
          <div className="space-y-3 text-center lg:hidden">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-orange shadow-lg shadow-orange/30">
              <Gift className="h-8 w-8 text-orange-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Promo Gifts</h1>
              <p className="text-sm text-muted-foreground">Plataforma de Vendas</p>
            </div>
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
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Bem-vindo de volta
                    </h2>
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
                      className="animate-fade-in space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="flex-1 space-y-1">
                          <p className="font-medium" data-testid="social-login-error-title">
                            {socialError.title}
                          </p>
                          <p className="break-words text-xs text-muted-foreground" data-testid="social-login-error-description">
                            {socialError.description}
                          </p>
                          {socialError.hint && (
                            <p className="break-words text-xs text-muted-foreground/90" data-testid="social-login-error-hint">
                              <span className="font-medium text-foreground/80">Dica: </span>
                              {socialError.hint}
                            </p>
                          )}
                          {socialError.isConfig && (
                            <p className="text-[11px] text-amber-700/90">
                              Este é um problema de configuração do provedor — não adianta tentar de novo agora.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="orange"
                          className="h-8 text-xs"
                          onClick={focusEmailFallback}
                          data-testid="social-fallback-use-email"
                        >
                          Entrar com e-mail e senha
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
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
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Entrando...
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

                    <SocialLoginButtons onError={handleSocialError} />
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
