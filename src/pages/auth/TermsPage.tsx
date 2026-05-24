import { PageSEO } from "@/components/seo/PageSEO";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function TermsPage() {
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-8 animate-fade-in">
      <PageSEO title="Termos de Uso" path="/termos" />
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-4">
          <Link
            to="/auth"
            data-testid="terms-back-link"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "-ml-2 gap-2 text-muted-foreground"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 data-testid="page-title-termos" className="font-display text-4xl font-bold tracking-tight">Termos de Uso</h1>
          <p className="text-muted-foreground">Última atualização: 16 de maio de 2026</p>
        </header>

        <section className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a <strong>Plataforma de Produtos Promo Gifts</strong>, você concorda em cumprir e estar vinculado aos seguintes Termos de Uso. Este sistema é propriedade intelectual exclusiva da Brasil Marcas.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Propriedade Intelectual</h2>
            <p>
              O sistema, incluindo seu software, design, algoritmos e base de dados, é protegido pela Lei nº 9.609/98 (Lei do Software) e demais normas de propriedade intelectual. É estritamente proibida qualquer reprodução, cópia, modificação, engenharia reversa ou uso não autorizado.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Uso da Plataforma</h2>
            <p>
              A plataforma é destinada exclusivamente para fins profissionais de visualização de catálogo, geração de orçamentos e inteligência comercial. O usuário é responsável pela guarda e sigilo de suas credenciais de acesso.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Limitação de Responsabilidade</h2>
            <p>
              A Promo Gifts envida esforços para manter a precisão das informações, porém não se responsabiliza por variações súbitas de estoque ou preços fornecidos por terceiros que ainda não tenham sido sincronizados no sistema.
            </p>
          </div>
        </section>

        <footer className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 Promo Gifts — Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
