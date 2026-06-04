import { m as motion } from 'framer-motion';
import { CheckCircle2, Mail, ArrowLeft, ExternalLink, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SpaceScene } from '@/pages/auth/AuthBranding';
import { PageSEO } from '@/components/seo/PageSEO';
import { AppLogo } from '@/components/layout/AppLogo';

export default function ForgotPasswordConfirmation() {
  const navigate = useNavigate();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030508] p-6">
      <SpaceScene />

      <PageSEO
        title="Solicitação Enviada"
        description="Instruções para recuperação de sua senha enviadas."
        path="/forgot-password-confirmation"
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl">
          <CardContent className="space-y-8 px-8 pb-10 pt-10 text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              className="relative mx-auto h-20 w-20"
            >
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20 duration-1000" />
              <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <Rocket className="h-10 w-10 -rotate-45" />
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-[#030508] bg-emerald-500 shadow-lg"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </motion.div>
            </motion.div>

            <div className="space-y-3">
              <h1 className="font-display text-2xl font-bold text-white">Solicitação em Análise</h1>
              <p className="leading-relaxed text-white/60">
                Recebemos seu pedido de recuperação. Por questões de segurança, nossa equipe
                revisará a solicitação.
              </p>
            </div>

            <div className="grid gap-4 text-left">
              <div className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <span className="text-sm font-bold text-blue-400">1</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Aprovação Manual</h3>
                  <p className="mt-1 text-xs text-white/40">
                    Um supervisor revisará seu acesso para garantir que ninguém mais esteja tentando
                    acessar sua conta.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <span className="text-sm font-bold text-blue-400">2</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">E-mail de Redefinição</h3>
                  <p className="mt-1 text-xs text-white/40">
                    Após aprovado, você receberá um e-mail com um link seguro para criar sua nova
                    senha.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <Button
                variant="outline"
                className="h-12 w-full gap-2 rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => window.open('https://mail.google.com', '_blank')}
              >
                <Mail className="h-4 w-4" />
                Abrir Gmail
                <ExternalLink className="h-3 w-3 opacity-40" />
              </Button>

              <Button
                variant="ghost"
                className="w-full text-white/40 hover:bg-transparent hover:text-white"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
