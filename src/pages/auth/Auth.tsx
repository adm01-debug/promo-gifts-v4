import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { resolveRedirectTarget } from '@/lib/auth/resolve-redirect-target';
import { resolveOAuthError, type OAuthErrorCopy } from '@/lib/auth/oauth-error-messages';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ShieldAlert,
  Globe,
  Wifi,
  AlertTriangle,
  RotateCw,
  Database,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Rocket,
} from 'lucide-react';
import { AuthBrandingPanel, SpaceScene } from '@/pages/auth/AuthBranding';

import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { LegalFooter } from '@/components/auth/LegalFooter';
import { SupabaseConnectionDebug } from '@/components/auth/SupabaseConnectionDebug';
import { useDevGate } from '@/hooks/admin/useDevGate';
import { useIPValidation } from '@/hooks/admin/useIPValidation';
import { SocialLoginButtons } from '@/components/auth/SocialLoginButtons';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { AppLogo } from '@/components/layout/AppLogo';
import { isSupabaseLighthousePlaceholder } from '@/lib/env/supabase-placeholder';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { logger } from '@/lib/logger';

type LoginForm = LoginFormData;

// ContinuousRockets and AuthBrandingPanel extracted to ./auth/AuthBranding.tsx

const authButtonClass = (...parts: Array<string | false | null | undefined>) =>
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    ...parts,
  ]
    .filter(Boolean)
    .join(' ');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const { validateIPForAuthenticatedUser, logLoginAttempt } = useIPValidation();
  const { isAllowed: isDevAllowed } = useDevGate();

  /**
   * Destino pós-login. Precedência:
   *  1. `location.state.from` (vindo do ProtectedRoute na mesma aba)
   *  2. `?redirect=/path` na URL (deep-link manual)
   *  3. `sessionStorage` (sobrevive ao round-trip OAuth)
   *  4. fallback `/`
   * Consumido aqui para que login por e-mail/senha também respeite o destino.
   */
  const resolveRedirectTargetCb = useCallback((): string => {
    const fromState = (
      location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null
    )?.from;
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

  // External Database Check State
  const [dbStatus, setDbStatus] = useState<{
    principal: { ok: boolean; url?: string; source?: string; loading: boolean };
    external: { ok: boolean; url?: string; source?: string; loading: boolean };
    crm: { ok: boolean; url?: string; source?: string; loading: boolean };
  }>({
    principal: { ok: false, loading: true },
    external: { ok: false, loading: true },
    crm: { ok: false, loading: true },
  });
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
      const nextError = resolveOAuthError(err);
      setSocialError({
        ...nextError,
        code: nextError.code ?? err,
        description: searchParams.get('error_description') ?? nextError.description,
        hint: searchParams.get('hint') ?? nextError.hint,
      });
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      next.delete('error_description');
      next.delete('hint');
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

  // Fetch IP, geolocation and backend status
  useEffect(() => {
    // Guarda de cancelamento: evita setState após o unmount do componente.
    // Sem isso, os awaits de loadInfo podem resolver depois do teardown e
    // disparar setDbStatus/setCurrentIP fora do ciclo de vida do React
    // (em testes, isso vaza como "ReferenceError: window is not defined").
    let cancelled = false;
    const isLighthousePlaceholder = isSupabaseLighthousePlaceholder();

    const loadInfo = async () => {
      // 1. IP Info
      if (!isLighthousePlaceholder) {
        try {
          const supabase = await getSupabaseClient();
          const { data, error } = await supabase.functions.invoke('get-visitor-info');
          if (!cancelled && !error && data) {
            if (data.ip) setCurrentIP(data.ip);
            if (data.city) setGeoLocation(`${data.city}, ${data.country_code}`);
          }
        } catch {
          // silent fail
        }
      }

      if (cancelled) return;

      // 2. Principal Backend (Directly from env or client)
      const principalUrl =
        import.meta.env.VITE_EXTERNAL_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const isExternal = !!import.meta.env.VITE_EXTERNAL_SUPABASE_URL;

      setDbStatus((prev) => ({
        ...prev,
        principal: {
          ok: !!principalUrl,
          url: principalUrl,
          source: isExternal ? 'Externo (Principal)' : 'Lovable Cloud',
          loading: false,
        },
      }));

      // 3. External (Gestão de Produtos) via bridge ping op
      if (isLighthousePlaceholder) {
        setDbStatus((prev) => ({ ...prev, external: { ok: false, loading: false } }));
        return;
      }

      try {
        const supabase = await getSupabaseClient();
        const { data, error } = await supabase.functions.invoke('external-db-bridge', {
          body: { operation: 'ping' },
        });

        if (cancelled) return;

        if (!error && data?.ok) {
          setDbStatus((prev) => ({
            ...prev,
            external: {
              ok: data.config?.has_url && data.config?.has_key,
              url: data.config?.url || 'Configurado',
              source: data.config?.is_external ? 'Externo' : 'Cloud',
              loading: false,
            },
          }));
        } else {
          setDbStatus((prev) => ({ ...prev, external: { ok: false, loading: false } }));
        }
      } catch {
        if (!cancelled) {
          setDbStatus((prev) => ({ ...prev, external: { ok: false, loading: false } }));
        }
      }
    };

    loadInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect if already logged in (only on initial load)
  const navigatedRef = useRef(false);
  useEffect(() => {
    if (user && !authLoading && !isSubmitting && !navigatedRef.current) {
      navigatedRef.current = true;
      const target = resolveRedirectTargetCb();
      setTimeout(() => navigate(target, { replace: true }), 100);
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
    } catch {
      logger.warn('[AUTH_POST_LOGIN_VALIDATION] continuing with fail-open redirect');
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
        logger.warn('[AUTH_FAILED] Authentication failed', { status: error.status ?? 'unknown' });
        await logLoginAttempt(data.email, null, false, error.message);

        let description = error.message;
        let diagnosis = 'Verifique as credenciais';
        let title = 'Erro ao entrar';

        // Heurística de erro baseada no código e mensagem
        if (error.message.includes('Invalid login credentials') || error.status === 400) {
          description = 'Email ou senha incorretos. Por favor, tente novamente.';
          diagnosis = 'AUTH_FAILED: Credenciais inválidas (400).';
        } else if (error.message.includes('Email not confirmed')) {
          description = 'E-mail pendente de confirmação. Por favor, valide sua conta.';
          diagnosis = 'AUTH_CONFIRM: Usuário existe mas e-mail não foi confirmado.';
        } else if (error.message.includes('rate limit') || error.status === 429) {
          title = 'Conta Temporariamente Bloqueada';
          description = 'Muitas tentativas falhas. Por segurança, aguarde alguns minutos.';
          diagnosis = 'RATE_LIMIT: Bloqueio temporário ativado (429).';
        } else if (
          error.status === 0 ||
          error.message.includes('network') ||
          error.message.includes('Fetch')
        ) {
          title = 'Erro de Conexão';
          description = 'Não foi possível alcançar o servidor. Verifique sua internet.';
          diagnosis = 'NETWORK_ERROR: Falha física ou DNS (0).';
        } else if (
          error.message.includes('Database error') ||
          (error.status !== undefined && error.status >= 500)
        ) {
          title = 'Erro no Servidor';
          description = 'O sistema está instável no momento. Nossa equipe já foi notificada.';
          diagnosis = `SERVER_ERROR: Erro interno do Supabase (${error.status || 500}).`;
        }

        toast({
          variant: 'destructive',
          title: title,
          description: (
            <div className="space-y-3">
              <p className="font-medium">{description}</p>
              <div className="rounded-lg border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-white/50">
                DIAGNÓSTICO: {diagnosis}
              </div>
              <button
                type="button"
                className={authButtonClass('h-auto p-0 text-xs text-white/60 hover:text-white')}
                onClick={() => navigate('/admin/status')}
              >
                Verificar status do sistema →
              </button>
            </div>
          ),
        });
        return;
      }

      // Credential Management API — pede ao navegador para salvar email/senha
      // após login bem-sucedido (Chrome/Edge/Brave). Silencioso se não suportado.
      try {
        const CredCtor = (
          window as unknown as {
            PasswordCredential?: new (init: {
              id: string;
              password: string;
              name?: string;
            }) => Credential;
          }
        ).PasswordCredential;
        if (CredCtor && navigator.credentials?.store) {
          const cred = new CredCtor({ id: data.email, password: data.password, name: data.email });
          await navigator.credentials.store(cred);
        }
      } catch {
        logger.warn('[AUTH_CRED_STORE] Credential store failed');
      }

      const supabase = await getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const userId = session?.user?.id;

      if (!userId) {
        toast({
          variant: 'destructive',
          title: 'Erro de sessão',
          description: 'Login realizado mas a sessão não pôde ser iniciada.',
        });
        return;
      }

      // 1. Verificação detalhada de Perfil (is_active)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('is_active, role')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        logger.error('[AUTH_PROFILE_FAILED] Failed to load authenticated profile', {
          code: profileError.code ?? 'unknown',
        });
        const isRLSError = profileError.code === 'PGRST301' || profileError.code === '42501';
        toast({
          variant: 'destructive',
          title: 'Erro de Sessão',
          description: (
            <div className="space-y-2">
              <p>Autenticado, mas não conseguimos carregar suas permissões.</p>
              <div className="rounded border border-white/5 bg-black/40 p-2 font-mono text-[9px] text-white/50">
                {isRLSError ? 'RLS_BLOCK' : 'PROFILE_MISSING'}: {profileError.code} -{' '}
                {profileError.message}
              </div>
            </div>
          ),
        });
      }

      if (profileData && profileData.is_active === false) {
        toast({
          variant: 'destructive',
          title: 'Acesso Bloqueado',
          description: 'Sua conta está inativa. Entre em contato com o administrador.',
        });
        await signOut();
        return;
      }

      // 2. Verificação de Roles (user_roles)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError || !rolesData || rolesData.length === 0) {
        logger.warn('[AUTH_RBAC_WARN] Authenticated user has no assigned roles', {
          code: rolesError?.code ?? 'none',
        });
      }

      // 3. Validação final de IP e Redirecionamento
      await validateAndRedirect(userId, data.email);
    } catch {
      logger.error('[AUTH_LOGIN_EXCEPTION] Unexpected login exception');
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Não foi possível conectar ao servidor. Verifique sua internet.',
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
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </main>
    );
  }

  if (user && !authLoading && !isSubmitting) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#030508] text-white">
        <SpaceScene />
        <div className="z-10 flex flex-col items-center gap-6 duration-500 animate-in fade-in zoom-in">
          <div className="relative">
            <AppLogo
              showText={false}
              iconClassName="h-20 w-20 rounded-2xl shadow-blue-500/40 animate-pulse"
              onClick={() => navigate('/')}
            />
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-success ring-4 ring-[#030508]">
              <Rocket className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="font-display text-2xl font-bold">Você já está conectado</h2>
            <p className="text-sm text-white/60">Redirecionando para sua área segura...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#030508] lg:flex-row"
      role="main"
      aria-label="Autenticação"
    >
      {/* Fundo unificado azul-noite saturado com cena espacial coordenada */}
      <SpaceScene />

      <PageSEO
        title="Login | Promo Gifts"
        description="Acesse a plataforma Promo Gifts. Entre com suas credenciais para gerenciar seus produtos e orçamentos com a melhor IA das Galáxias!"
        path="/auth"
      />
      {/* Left side - Branding */}
      <AuthBrandingPanel onLogoClick={() => window.location.reload()} />

      {/* Right side - Auth Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-5 lg:p-10">
        <div className="w-full max-w-[22.2rem] animate-fade-in space-y-7">
          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden">
            <AppLogo onClick={() => window.location.reload()} />
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
                    <button
                      type="button"
                      className={authButtonClass(
                        'mt-2 h-9 rounded-lg border-2 border-primary/30 bg-background px-3 text-primary hover:border-primary hover:bg-primary/5',
                      )}
                      onClick={() => {
                        setIpBlocked(false);
                        setBlockedIP(null);
                      }}
                    >
                      Tentar novamente
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auth Card */}
          <Card
            aria-labelledby="auth-title"
            className={`relative overflow-hidden rounded-[2rem] border-white/10 bg-black/60 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-500 ${ipBlocked ? 'pointer-events-none opacity-50' : ''}`}
          >
            {loginStatus === 'success' ? (
              <div
                key="success"
                className="flex flex-col items-center justify-center px-8 py-16 text-center duration-500 animate-in fade-in zoom-in"
              >
                <div className="relative mb-8">
                  <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/30 duration-700" />
                  <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-blue-500/10 text-blue-400 shadow-[0_0_50px_rgba(59,130,246,0.5)] ring-1 ring-blue-500/20">
                    <Rocket className="h-12 w-12 -rotate-45 animate-bounce" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#030508] bg-emerald-500 shadow-lg duration-300 animate-in zoom-in">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                  Decolagem autorizada!
                </h2>
                <p className="mt-3 text-base text-white/50">
                  Bem-vindo a bordo. Iniciando sistemas...
                </p>
              </div>
            ) : showForgotPassword ? (
              <div
                key="forgot-password"
                className="duration-300 animate-in fade-in slide-in-from-right-2"
              >
                <CardContent className="pb-7 pt-7">
                  <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
                </CardContent>
              </div>
            ) : (
              <div
                key="login-form"
                className="duration-300 animate-in fade-in slide-in-from-left-2"
              >
                <CardHeader className="pb-3 pt-9">
                  <div className="space-y-1 text-center">
                    <div
                      className="font-display text-[1.036rem] font-normal tracking-tight text-white"
                      id="auth-title"
                    >
                      Entre com suas credenciais para Brilhar, você nasce para isso!
                    </div>
                    <p className="text-[13px] text-white/50">Inicie sua jornada rumo ao sucesso</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 pb-9">
                  {socialError && (
                    <div
                      role="alert"
                      className="relative space-y-3 overflow-hidden rounded-[1.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 text-sm shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
                    >
                      <div className="absolute right-0 top-0 p-2 opacity-10">
                        <ShieldAlert className="h-12 w-12 text-amber-500" />
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 shadow-inner">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <h3
                            className="font-display text-base font-bold text-amber-200"
                            data-testid="social-login-error-title"
                          >
                            {socialError.title}
                          </h3>
                          <p
                            className="text-[13px] leading-relaxed text-amber-100/70"
                            data-testid="social-login-error-description"
                          >
                            {socialError.description}
                          </p>
                          {socialError.code && (
                            <p
                              className="font-mono text-[10px] uppercase tracking-wide text-amber-100/40"
                              data-testid="social-login-error-code"
                            >
                              Código: {socialError.code}
                            </p>
                          )}
                          {socialError.hint && (
                            <div
                              className="mt-3 rounded-xl border border-white/5 bg-black/40 p-3"
                              data-testid="social-login-error-hint"
                            >
                              <p className="text-[11px] leading-snug text-white/60">
                                <span className="mr-2 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                                  Solução:
                                </span>
                                {socialError.hint}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-3">
                        <div className="flex items-center gap-2">
                          {!socialError.isConfig && (
                            <button
                              type="button"
                              className={authButtonClass(
                                'h-11 flex-1 rounded-xl bg-amber-500 text-xs text-black shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95',
                              )}
                              onClick={handleRetryGoogle}
                            >
                              <RotateCw className="h-4 w-4" />
                              Tentar Google Novamente
                            </button>
                          )}
                          <button
                            type="button"
                            className={authButtonClass(
                              'h-11 flex-1 rounded-xl border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 active:scale-95',
                            )}
                            onClick={focusEmailFallback}
                          >
                            Usar E-mail
                          </button>
                        </div>
                        <button
                          type="button"
                          className={authButtonClass(
                            'h-8 rounded-lg px-3 text-[10px] uppercase tracking-widest text-white/30 hover:bg-transparent hover:text-white/60',
                          )}
                          onClick={() => setSocialError(null)}
                        >
                          Ignorar aviso
                        </button>
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={loginForm.handleSubmit(handleLogin)}
                    className="space-y-4"
                    data-testid="login-form"
                    name="login"
                    noValidate
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="login-email"
                        className="text-sm font-medium leading-none text-foreground"
                      >
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-email"
                          data-testid="login-email-input"
                          type="email"
                          placeholder="seu@email.com"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="border-white/10 bg-white/5 pl-10 lowercase transition-all duration-300 placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                          {...loginForm.register('email')}
                          onChange={(e) => {
                            const lower = e.target.value.toLowerCase();
                            if (e.target.value !== lower) e.target.value = lower;
                            loginForm.register('email').onChange(e);
                          }}
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
                      <label
                        htmlFor="login-password"
                        title="password"
                        className="text-sm font-medium leading-none text-foreground"
                      >
                        Senha de Acesso
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          data-testid="login-password-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="border-white/10 bg-white/5 pl-10 pr-10 transition-all duration-300 placeholder:text-white/20 focus:border-primary/50 focus:ring-primary/20"
                          {...loginForm.register('password')}
                        />
                        <button
                          type="button"
                          data-testid="login-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -mr-2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-blue-500"
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          aria-pressed={showPassword}
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
                      <button
                        type="button"
                        data-testid="login-forgot-link"
                        className="h-auto p-0 text-xs font-bold uppercase tracking-wider text-blue-400 transition-colors hover:text-blue-300"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <button
                      type="submit"
                      data-testid="login-submit"
                      className={authButtonClass(
                        'h-12 w-full rounded-xl border border-white/10 bg-blue-600 text-base text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 active:scale-[0.98]',
                      )}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Iniciando Sistemas...
                        </>
                      ) : (
                        'Entrar na Plataforma'
                      )}
                    </button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="rounded-full border border-white/5 bg-black/80 px-4 text-white/30">
                          ou
                        </span>
                      </div>
                    </div>

                    <SocialLoginButtons onError={handleSocialError} retryRef={googleRetryRef} />
                  </form>
                </CardContent>
              </div>
            )}
          </Card>

          {/* IP/Location Widget */}
          {currentIP && (
            <div
              className="mx-auto flex max-w-fit items-center justify-center gap-4 rounded-full border border-white/5 bg-black/40 px-6 py-2.5 opacity-0 shadow-lg backdrop-blur-md transition-all hover:border-white/10 hover:bg-black/60"
              style={{ animation: 'scale-fade-in 0.5s ease-out 600ms forwards' }}
            >
              <div className="flex items-center gap-2.5 text-xs text-white/50">
                <Globe className="h-4 w-4 text-blue-500/80" />
                <span className="font-mono tracking-wider">{currentIP}</span>
              </div>
              {geoLocation && (
                <>
                  <div className="h-4 w-px bg-white/10" />
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Wifi className="h-4 w-4 text-emerald-500/80" />
                    <span className="font-medium">{geoLocation}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Backend Status Widget — apenas visível para devs (gate via useDevGate) */}
          {isDevAllowed && (
            <div
              className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 opacity-0 shadow-xl backdrop-blur-md"
              style={{ animation: 'scale-fade-in 0.5s ease-out 800ms forwards' }}
            >
              <div className="mb-1 flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Status da Infraestrutura
                </span>
              </div>

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Principal DB */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-medium text-white/80">Principal</span>
                  </div>
                  {dbStatus.principal.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white/20" />
                  ) : dbStatus.principal.ok ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-success">
                        {dbStatus.principal.source}
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>

                {/* External DB (Gestão de Produtos) */}
                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-medium text-white/80">Produtos</span>
                  </div>
                  {dbStatus.external.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white/20" />
                  ) : dbStatus.external.ok ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-success">
                        Externo
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-warning">
                        Pendente
                      </span>
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    </div>
                  )}
                </div>
              </div>

              <p className="px-2 text-center text-[10px] italic text-white/30">
                Verificação em tempo real das instâncias Supabase configuradas via secrets.
              </p>
            </div>
          )}

          <LegalFooter />
          <SupabaseConnectionDebug />
        </div>
      </div>
    </main>
  );
}
