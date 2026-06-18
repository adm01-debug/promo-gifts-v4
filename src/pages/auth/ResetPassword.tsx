import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { AppLogo } from '@/components/layout/AppLogo';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageSEO } from '@/components/seo/PageSEO';
import { LegalFooter } from '@/components/auth/LegalFooter';
import { SpaceScene } from '@/pages/auth/AuthBranding';

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')
      .regex(/[a-z]/, 'Senha deve conter letra minúscula')
      .regex(/[0-9]/, 'Senha deve conter número')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Senha deve conter caractere especial'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    // Check if there's a valid recovery session
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // If user came from password reset email, they'll have a session
        if (session) {
          setIsValidToken(true);
        } else {
          // Check URL hash for access token (Supabase redirect format)
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const accessToken = hashParams.get('access_token');
          const type = hashParams.get('type');

          if (accessToken && type === 'recovery') {
            setIsValidToken(true);
          }
        }
      } catch {
        // getSession failed (e.g. lock contention) — treat as no valid session
      }
      setIsCheckingToken(false);
    };

    checkSession();

    // Listen for auth state changes (when token is validated)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidToken(true);
        setIsCheckingToken(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erro ao redefinir senha',
          description: 'Não foi possível redefinir sua senha. O link pode ter expirado.',
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi alterada com sucesso.',
      });

      // Redirect after 3 seconds
      redirectTimerRef.current = setTimeout(() => {
        navigate('/');
      }, 3000);
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

  if (isCheckingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[#030508]">
        <SpaceScene />
        <PageSEO
          title="Redefinir Senha"
          description="Redefina sua senha de acesso à plataforma Promo Gifts."
          path="/reset-password"
        />
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030508] p-6">
        <SpaceScene />
        <Card className="relative z-10 w-full max-w-md rounded-[2rem] border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-6 px-8 pb-10 pt-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-white">
                Link inválido ou expirado
              </h2>
              <p className="text-sm text-white/50">
                Este link de recuperação de senha não é mais válido ou já foi utilizado.
              </p>
            </div>
            <Button
              className="h-12 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => navigate('/login')}
            >
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030508] p-6">
        <SpaceScene />
        <Card className="relative z-10 w-full max-w-md rounded-[2rem] border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-8 px-8 pb-10 pt-10 text-center">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-success/20 duration-1000" />
              <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-success/10 text-success shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <CheckCircle className="h-10 w-10" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold text-white">Senha redefinida!</h2>
              <p className="text-sm leading-relaxed text-white/50">
                Sua senha foi alterada com sucesso. Em instantes você será redirecionado para
                decolar conosco!
              </p>
            </div>
            <Button
              className="h-12 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => navigate('/login')}
            >
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030508] p-6">
      <SpaceScene />
      <div className="relative z-10 w-full max-w-md animate-fade-in space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <AppLogo />
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-4 pt-8">
            <div className="space-y-1 text-center">
              <h1 className="font-display text-2xl font-bold text-white">Nova Senha</h1>
              <p className="text-sm text-white/50">Defina sua nova chave de acesso</p>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-10 pt-2">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" title="password" className="text-white">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-11 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white transition-all focus:border-blue-500/50 focus:ring-blue-500/20"
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -mr-2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-white/40 transition-colors hover:text-blue-400"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
                <div className="pt-1">
                  <PasswordStrengthIndicator password={form.watch('password')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" title="confirmPassword" className="text-white">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-11 rounded-xl border-white/10 bg-white/5 pl-10 text-white transition-all focus:border-blue-500/50 focus:ring-blue-500/20"
                    {...form.register('confirmPassword')}
                  />
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl border border-white/10 bg-blue-600 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Redefinir Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        <LegalFooter withDivider={false} className="mt-6" />
      </div>
    </div>
  );
}
