import { motion } from 'framer-motion';
import { CheckCircle2, Mail, ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SpaceScene } from './auth/AuthBranding';
import { PageSEO } from '@/components/seo/PageSEO';
import { AppLogo } from '@/components/layout/AppLogo';

export default function ForgotPasswordConfirmation() {
  const navigate = useNavigate();

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#030508] p-6 overflow-hidden">
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

        <Card className="border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardContent className="pt-10 pb-10 px-8 text-center space-y-8">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/20 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
            >
              <CheckCircle2 className="h-10 w-10" />
            </motion.div>

            <div className="space-y-3">
              <h1 className="text-2xl font-display font-bold text-white">Solicitação em Análise</h1>
              <p className="text-white/60 leading-relaxed">
                Recebemos seu pedido de recuperação. Por questões de segurança, nossa equipe revisará a solicitação.
              </p>
            </div>

            <div className="grid gap-4 text-left">
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 items-start">
                <div className="mt-1 h-8 w-8 shrink-0 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Aprovação Manual</h3>
                  <p className="text-xs text-white/40 mt-1">
                    Um supervisor revisará seu acesso para garantir que ninguém mais esteja tentando acessar sua conta.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 items-start">
                <div className="mt-1 h-8 w-8 shrink-0 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <span className="text-blue-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">E-mail de Redefinição</h3>
                  <p className="text-xs text-white/40 mt-1">
                    Após aprovado, você receberá um e-mail com um link seguro para criar sua nova senha.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                onClick={() => window.open('https://mail.google.com', '_blank')}
              >
                <Mail className="h-4 w-4" />
                Abrir Gmail
                <ExternalLink className="h-3 w-3 opacity-40" />
              </Button>

              <Button 
                variant="ghost" 
                className="w-full text-white/40 hover:text-white hover:bg-transparent"
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
