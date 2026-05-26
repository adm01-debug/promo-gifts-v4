import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2, ArrowLeft, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/ui/use-toast';
import { usePasswordResetRequests } from '@/hooks/auth/usePasswordResetRequests';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onBack: () => void;
}

const authButtonClass = (...parts: Array<string | false | null | undefined>) =>
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    ...parts,
  ]
    .filter(Boolean)
    .join(' ');

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createRequest } = usePasswordResetRequests();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    try {
      const result = await createRequest(data.email);

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Erro ao enviar solicitação',
          description: result.message,
        });
        return;
      }

      toast({
        title: 'Solicitação enviada!',
        description: result.message,
      });

      // Navega para a página de confirmação com instruções detalhadas
      navigate('/forgot-password-confirmation');
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {requestSent ? (
        <div
          key="request-sent"
          className="space-y-6 py-4 text-center duration-300 animate-in fade-in zoom-in"
        >
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 ring-1 ring-warning/20">
              <Clock className="h-8 w-8 animate-pulse text-warning" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-white">Solicitação enviada!</h2>
            <p className="text-sm text-white/50">
              Sua solicitação de recuperação de senha para{' '}
              <span className="font-medium text-white">{form.getValues('email')}</span> foi enviada
              para aprovação.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <p className="text-sm text-white/60">
              <strong className="text-white">Próximo passo:</strong> Um gestor irá analisar sua
              solicitação. Após a aprovação, você receberá um email com o link para redefinir sua
              senha.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              className={authButtonClass(
                'h-11 w-full rounded-xl px-4 text-white/40 hover:bg-white/5 hover:text-white',
              )}
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </button>
          </div>
        </div>
      ) : (
        <div
          key="form"
          className="space-y-6 duration-300 animate-in fade-in"
          data-testid="forgot-password-screen"
        >
          <div className="space-y-2 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Esqueceu sua senha?
            </h2>
            <p className="text-[13px] leading-relaxed text-white/50">
              Não se preocupe, comandante! Digite seu e-mail abaixo para iniciarmos o procedimento
              de resgate.
            </p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="forgot-email" className="text-sm font-medium leading-none text-white">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="border-white/10 bg-white/5 pl-10 lowercase text-white transition-all duration-300 placeholder:text-white/20 focus:border-blue-500/50 focus:ring-blue-500/20"
                  {...form.register('email')}
                  onChange={(e) => {
                    const lower = e.target.value.toLowerCase();
                    if (e.target.value !== lower) e.target.value = lower;
                    form.register('email').onChange(e);
                  }}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className={authButtonClass(
                'h-11 w-full rounded-xl border border-white/10 bg-blue-600 text-base font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98]',
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar link de recuperação'
              )}
            </button>
          </form>

          <button
            type="button"
            className={authButtonClass(
              'h-11 w-full rounded-xl px-4 text-white/40 hover:bg-white/5 hover:text-white',
            )}
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para a Base
          </button>
        </div>
      )}
    </>
  );
}

export default ForgotPasswordForm;
