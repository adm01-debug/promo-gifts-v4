import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
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
          description: 'Não foi possível processar sua solicitação. Tente novamente.',
        });
        return;
      }

      toast({
        title: 'Solicitação enviada!',
        description: 'Confira seu e-mail com as instruções para redefinir a senha.',
      });

      // Navega para a página de confirmação com instruções detalhadas
      navigate('/forgot-password-confirmation');
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

  return (
    <div className="space-y-6 duration-300 animate-in fade-in" data-testid="forgot-password-screen">
      <div className="space-y-2 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white">
          Esqueceu sua senha?
        </h2>
        <p className="text-[13px] leading-relaxed text-white/50">
          Não se preocupe, comandante! Digite seu e-mail abaixo para iniciarmos o procedimento de
          resgate.
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
  );
}

export default ForgotPasswordForm;
