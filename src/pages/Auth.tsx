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
  Database,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Rocket,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthBrandingPanel, Starfield, SpaceScene } from './auth/AuthBranding';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { LegalFooter } from '@/components/auth/LegalFooter';
import { useIPValidation } from '@/hooks/useIPValidation';
import { useDevGate } from '@/hooks/useDevGate';
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

  // Fetch IP, geolocation and backend status
  useEffect(() => {
    const loadInfo = async () => {
      // 1. IP Info
      try {
        const { data, error } = await supabase.functions.invoke('get-visitor-info');
        if (!error && data) {
          if (data.ip) setCurrentIP(data.ip);
          if (data.city) setGeoLocation(`${data.city}, ${data.country_code}`);
        }
      } catch {
        // silent fail
      }

      // 2. Principal Backend (Directly from env or client)
      const principalUrl = import.meta.env.VITE_EXTERNAL_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      const isExternal = !!import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
      
      setDbStatus(prev => ({
        ...prev,
        principal: { 
          ok: !!principalUrl, 
          url: principalUrl, 
          source: isExternal ? 'Externo (Principal)' : 'Lovable Cloud',
          loading: false 
        }
      }));

      // 3. External (Gestão de Produtos) via bridge ping op
      try {
        const { data, error } = await supabase.functions.invoke('external-db-bridge', {
          body: { operation: 'ping' }
        });

        if (!error && data?.ok) {
          setDbStatus(prev => ({
            ...prev,
            external: { 
              ok: data.config?.has_url && data.config?.has_key, 
              url: data.config?.url || 'Configurado', 
              source: data.config?.is_external ? 'Externo' : 'Cloud', 
              loading: false 
            }
          }));
        } else {
          setDbStatus(prev => ({ ...prev, external: { ok: false, loading: false } }));
        }
      } catch (err) {
        setDbStatus(prev => ({ ...prev, external: { ok: false, loading: false } }));
      }
    };
    
    loadInfo();
  }, []);

  // Redirect if already logged in (only on initial load)
  useEffect(() => {
    if (user && !authLoading && !isSubmitting) {
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
      const { error, data: signInData } = await signIn(data.email, data.password);

      if (error) {
        await logLoginAttempt(data.email, null, false, error.message);

        let description = error.message;
        let diagnosis = "Verifique as credenciais";

        if (error.message.includes('Invalid login credentials')) {
          description = 'Email ou senha incorretos';
          diagnosis = "AUTH_FAILED: Senha não confere ou usuário não existe no Supabase.";
        } else if (error.message.includes('Email not confirmed')) {
          description = 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
          diagnosis = "AUTH_CONFIRM: Usuário existe mas e-mail está pendente de validação.";
        } else if (error.message.includes('Database error')) {
          description = 'Erro de sincronização com o banco de dados. Tente novamente em instantes.';
          diagnosis = "DB_ERROR: Supabase recusou a conexão ou RLS está bloqueando o acesso inicial.";
        }

        toast({
          variant: 'destructive',
          title: 'Erro ao entrar',
          description: (
            <div className="space-y-3">
              <p className="font-medium">{description}</p>
              <div className="p-2 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] text-white/50">
                DIAGNÓSTICO: {diagnosis}
              </div>
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-xs text-white/60 hover:text-white"
                onClick={() => navigate('/admin/status')}
              >
                Executar teste completo de conexão →
              </Button>
            </div>
          ),
        });
        return;
      }

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
        const isRLSError = profileError.code === 'PGRST301' || profileError.code === '42501';
        toast({
          variant: 'destructive',
          title: 'Erro ao validar perfil',
          description: (
            <div className="space-y-2">
              <p>Não conseguimos carregar suas permissões.</p>
              <div className="p-2 bg-black/40 rounded border border-white/5 font-mono text-[9px] text-white/50">
                {isRLSError ? 'FALHA_RLS' : 'FALHA_PERFIL'}: {profileError.code} - {profileError.message}
              </div>
            </div>
          ),
        });
        // Se for erro de RLS ou perfil ausente, pode ser um problema crítico de sincronização
        if (isRLSError) {
          console.error('[AUTH_DIAGNOSTIC] RLS Block on profile fetch after login');
        }
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
        console.warn('[AUTH_DIAGNOSTIC] User logged in but has no roles assigned');
        // Não bloqueia o login, mas registra o diagnóstico
      }

      // 3. Validação final de IP e Redirecionamento
      await validateAndRedirect(userId, data.email);
      
    } catch (err) {
      console.error('Login exception:', err);
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
        <div className="z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <AppLogo showText={false} iconClassName="h-20 w-20 rounded-2xl shadow-blue-500/40 animate-pulse" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success flex items-center justify-center ring-4 ring-[#030508]">
              <Rocket className="h-3 w-3 text-white" />
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
      className="relative flex flex-col lg:flex-row min-h-screen bg-[#030508] overflow-x-hidden"
      role="main"
      aria-label="Autenticação"
    >
      {/* Fundo unificado azul-noite saturado com cena espacial coordenada */}
      <SpaceScene />

      <PageSEO
        title="Login | Promo Gifts"
        description="Acesse a plataforma Promo Gifts. Entre com suas credenciais para gerenciar seus produtos e orçamentos com a melhor IA das Galáxias!"
        path="/login"
      />
      {/* Left side - Branding */}
      <AuthBrandingPanel />


      {/* Right side - Auth Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-5 lg:p-10">
        <div className="w-full max-w-[22.2rem] animate-fade-in space-y-7">
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
            aria-labelledby="auth-title"
            className={`relative border-white/10 bg-black/60 shadow-2xl shadow-black/60 backdrop-blur-xl rounded-[2rem] overflow-hidden transition-all duration-500 ${ipBlocked ? 'pointer-events-none opacity-50' : ''}`}
          >
            <AnimatePresence mode="wait">
              {loginStatus === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center justify-center py-16 px-8 text-center"
                >
                  <div className="relative mb-8">
                    <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/30 duration-700" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.5)] overflow-hidden">
                      <Rocket className="h-12 w-12 -rotate-45 animate-bounce" />
                    </div>
                    <motion.div 
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 }}
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-4 border-[#030508]"
                    >
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </motion.div>
                  </div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="font-display text-3xl font-bold text-white tracking-tight"
                  >
                    Decolagem autorizada!
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-3 text-base text-white/50"
                  >
                    Bem-vindo a bordo. Iniciando sistemas...
                  </motion.p>
                </motion.div>
              ) : showForgotPassword ? (
                <motion.div
                  key="forgot-password"
                  initial={{ opacity: 0, x: 20, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -20, filter: 'blur(5px)' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CardContent className="pb-7 pt-7">
                    <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
                  </CardContent>
                </motion.div>
              ) : (
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, x: -20, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: 20, filter: 'blur(5px)' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <CardHeader className="pb-3 pt-9">
                    <div className="space-y-1 text-center">
                      <div className="font-display text-[1.036rem] font-normal text-white tracking-tight" id="auth-title">
                        Entre com suas credenciais para Brilhar, você nasce para isso!
                      </div>
                      <p className="text-[13px] text-white/50">
                        Inicie sua jornada rumo ao sucesso
                      </p>
                    </div>
                  </CardHeader>

                <CardContent className="space-y-5 pb-9">
                  {socialError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      role="alert"
                      className="relative overflow-hidden animate-fade-in space-y-3 rounded-[1.5rem] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5 text-sm shadow-2xl backdrop-blur-xl"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <ShieldAlert className="h-12 w-12 text-amber-500" />
                      </div>
                      
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 shadow-inner">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <h3 className="font-display text-base font-bold text-amber-200" data-testid="social-login-error-title">
                            {socialError.title}
                          </h3>
                          <p className="text-[13px] leading-relaxed text-amber-100/70" data-testid="social-login-error-description">
                            {socialError.description}
                          </p>
                          {socialError.hint && (
                            <div className="mt-3 rounded-xl bg-black/40 p-3 border border-white/5" data-testid="social-login-error-hint">
                              <p className="text-[11px] leading-snug text-white/60">
                                <span className="font-bold uppercase tracking-wider text-[9px] text-amber-500 mr-2">Solução:</span>
                                {socialError.hint}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-3">
                        <div className="flex items-center gap-2">
                          {!socialError.isConfig && (
                            <Button
                              type="button"
                              className="flex-1 h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition-all active:scale-95 rounded-xl shadow-lg shadow-amber-500/20"
                              onClick={handleRetryGoogle}
                            >
                              <RotateCw className="h-4 w-4" />
                              Tentar Google Novamente
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-11 text-xs font-bold border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl transition-all active:scale-95"
                            onClick={focusEmailFallback}
                          >
                            Usar E-mail
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 hover:bg-transparent"
                          onClick={() => setSocialError(null)}
                        >
                          Ignorar aviso
                        </Button>
                      </div>
                    </motion.div>
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
                          inputMode="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="border-white/10 bg-white/5 pl-10 lowercase focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-white/20"
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
                      <Label htmlFor="login-password" title="password" className="text-foreground">
                        Senha de Acesso
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="login-password"
                          data-testid="login-password-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="border-white/10 bg-white/5 pl-10 pr-10 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-white/20"
                          {...loginForm.register('password')}
                        />
                        <button
                          type="button"
                          data-testid="login-password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -mr-2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-blue-500"
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
                      <button
                        type="button"
                        data-testid="login-forgot-link"
                        className="h-auto p-0 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <Button
                      type="submit"
                      data-testid="login-submit"
                      className="h-12 w-full text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 border border-white/10 rounded-xl active:scale-[0.98]"
                        disabled={isSubmitting || loginStatus === 'success'}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Iniciando Sistemas...
                          </>
                        ) : loginStatus === 'success' ? (
                          <>
                            <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                              <Rocket className="h-4 w-4 -rotate-45" />
                              <span>Decolando!</span>
                            </div>
                          </>
                        ) : (
                          'Entrar na Plataforma'
                        )}
                      </Button>

                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                      </div>
                      <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                        <span className="bg-black/80 px-4 text-white/30 rounded-full border border-white/5">
                          ou
                        </span>
                      </div>
                    </div>

                    <SocialLoginButtons onError={handleSocialError} retryRef={googleRetryRef} />
                  </form>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

          {/* IP/Location Widget */}
          {currentIP && (
            <div
              className="mx-auto flex max-w-fit items-center justify-center gap-4 rounded-full border border-white/5 bg-black/40 px-6 py-2.5 opacity-0 shadow-lg backdrop-blur-md transition-all hover:bg-black/60 hover:border-white/10"
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
              className="mx-auto flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-md opacity-0"
              style={{ animation: 'scale-fade-in 0.5s ease-out 800ms forwards' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Server className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">Status da Infraestrutura</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {/* Principal DB */}
                <div className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-medium text-white/80">Principal</span>
                  </div>
                  {dbStatus.principal.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white/20" />
                  ) : dbStatus.principal.ok ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-success font-bold uppercase tracking-tighter">{dbStatus.principal.source}</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>

                {/* External DB (Gestão de Produtos) */}
                <div className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-[11px] font-medium text-white/80">Produtos</span>
                  </div>
                  {dbStatus.external.loading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-white/20" />
                  ) : dbStatus.external.ok ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-success font-bold uppercase tracking-tighter">Externo</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-warning font-bold uppercase tracking-tighter">Pendente</span>
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    </div>
                  )}
                </div>
              </div>
              
              <p className="text-[10px] text-white/30 italic text-center px-2">
                Verificação em tempo real das instâncias Supabase configuradas via secrets.
              </p>
            </div>
          )}

          <LegalFooter />
        </div>
      </div>
    </main>
  );
}
