import { PageSEO } from '@/components/seo/PageSEO';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SpaceScene } from '@/pages/auth/AuthBranding';

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#030508] text-white">
      <SpaceScene />
      <PageSEO title="Política de Privacidade" path="/privacidade" />

      <div className="relative z-10 mx-auto w-full max-w-4xl animate-fade-in space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="space-y-6">
          <Link
            to="/auth"
            data-testid="privacy-back-link"
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              '-ml-2 gap-2 text-white/60 transition-all hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#030508]',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar para o Login
          </Link>
          <div className="space-y-2">
            <h1
              data-testid="page-title-privacidade"
              className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              Política de Privacidade
            </h1>
            <p className="text-sm font-medium text-white/40">
              Última atualização: 16 de maio de 2026
            </p>
          </div>
        </header>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <section className="prose prose-invert max-w-none space-y-10 text-white/80">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">1. Coleta de Dados</h2>
            <p className="leading-relaxed">
              Coletamos dados necessários para a prestação de nossos serviços, incluindo informações
              de identificação profissional, logs de acesso e interações com o catálogo para fins de
              melhoria da experiência e segurança.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">2. Uso das Informações</h2>
            <p className="leading-relaxed">
              As informações coletadas são utilizadas para personalizar seu acesso, processar
              orçamentos, garantir a segurança contra fraudes e realizar análises estatísticas
              anônimas sobre tendências de mercado.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">3. Segurança</h2>
            <p className="leading-relaxed">
              Implementamos medidas técnicas e organizacionais avançadas para proteger seus dados
              contra acessos não autorizados, perda ou destruição, em conformidade com as melhores
              práticas de segurança da informação.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">4. Seus Direitos</h2>
            <p className="leading-relaxed">
              Você possui o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer
              momento através das configurações de perfil ou entrando em contato com nosso suporte
              técnico.
            </p>
          </div>
        </section>

        <footer className="border-t border-white/10 pt-8 text-center text-sm text-white/40">
          <p>© 2026 Promo Gifts — Todos os direitos reservados.</p>
        </footer>
      </div>
    </main>
  );
}
