import { PageSEO } from '@/components/seo/PageSEO';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SpaceScene } from '@/pages/auth/AuthBranding';

export default function TermsPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#030508] text-white">
      <SpaceScene />
      <PageSEO title="Termos de Uso" path="/termos" />

      <div className="relative z-10 mx-auto w-full max-w-4xl animate-fade-in space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="space-y-6">
          <Link
            to="/auth"
            data-testid="terms-back-link"
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
              data-testid="page-title-termos"
              className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl"
            >
              Termos de Uso
            </h1>
            <p className="text-sm font-medium text-white/40">
              Última atualização: 16 de maio de 2026
            </p>
          </div>
        </header>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <section className="prose prose-invert max-w-none space-y-10 text-white/80">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">1. Aceitação dos Termos</h2>
            <p className="leading-relaxed">
              Ao acessar e utilizar a{' '}
              <strong className="text-blue-400">Plataforma de Produtos Promo Gifts</strong>, você
              concorda em cumprir e estar vinculado aos seguintes Termos de Uso. Este sistema é
              propriedade intelectual exclusiva da Brasil Marcas.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">2. Propriedade Intelectual</h2>
            <p className="leading-relaxed">
              O sistema, incluindo seu software, design, algoritmos e base de dados, é protegido
              pela Lei nº 9.609/98 (Lei do Software) e demais normas de propriedade intelectual. É
              estritamente proibida qualquer reprodução, cópia, modificação, engenharia reversa ou
              uso não autorizado.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">3. Uso da Plataforma</h2>
            <p className="leading-relaxed">
              A plataforma é destinada exclusivamente para fins profissionais de visualização de
              catálogo, geração de orçamentos e inteligência comercial. O usuário é responsável pela
              guarda e sigilo de suas credenciais de acesso.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">4. Limitação de Responsabilidade</h2>
            <p className="leading-relaxed">
              A Promo Gifts envida esforços para manter a precisão das informações, porém não se
              responsabiliza por variações súbitas de estoque ou preços fornecidos por terceiros que
              ainda não tenham sido sincronizados no sistema.
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
