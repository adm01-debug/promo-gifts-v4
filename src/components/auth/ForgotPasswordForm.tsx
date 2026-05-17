import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { usePasswordResetRequests } from '@/hooks/usePasswordResetRequests';
import { motion, AnimatePresence } from 'framer-motion';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { toast } = useToast();
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

      setRequestSent(true);
      toast({
        title: 'Solicitação enviada!',
        description: result.message,
      });
    } catch (error) {
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
    <AnimatePresence mode="wait">
      {requestSent ? (
        <motion.div
          key="request-sent"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 text-center py-4"
        >
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center ring-1 ring-warning/20">
              <Clock className="h-8 w-8 text-warning animate-pulse" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-white">Solicitação enviada!</h2>
            <p className="text-sm text-white/50">
              Sua solicitação de recuperação de senha para{' '}
              <span className="font-medium text-white">{form.getValues('email')}</span>{' '}
              foi enviada para aprovação.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <p className="text-sm text-white/60">
              <strong className="text-white">Próximo passo:</strong> Um gestor irá analisar sua solicitação. 
              Após a aprovação, você receberá um email com o link para redefinir sua senha.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full text-white/40 hover:text-white hover:bg-white/5"
              onClick={onBack}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
          data-testid="forgot-password-screen"
        >
          <div className="text-center space-y-1">
            <h2 className="font-display text-xl font-semibold text-white">Esqueceu sua senha?</h2>
            <p className="text-sm text-white/50">
              Digite seu email e enviaremos um link para redefinir sua senha
            </p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-white">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="pl-10 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 placeholder:text-white/20"
                  {...form.register('email')}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-destructive font-medium">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] rounded-xl text-white border border-white/10"
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
            </Button>
          </form>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-white/40 hover:text-white hover:bg-white/5"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao login
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ForgotPasswordForm;