import { PageSEO } from "@/components/seo/PageSEO";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <PageSEO title="Política de Privacidade" />
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-4">
          <Button variant="ghost" asChild className="-ml-2 gap-2 text-muted-foreground">
            <Link to="/auth">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <h1 className="font-display text-4xl font-bold tracking-tight">Política de Privacidade</h1>
          <p className="text-muted-foreground">Última atualização: 16 de maio de 2026</p>
        </header>

        <section className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-foreground/90">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Coleta de Dados</h2>
            <p>
              Coletamos dados necessários para a prestação de nossos serviços, incluindo informações de identificação profissional, logs de acesso e interações com o catálogo para fins de melhoria da experiência e segurança.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Uso das Informações</h2>
            <p>
              As informações coletadas são utilizadas para personalizar seu acesso, processar orçamentos, garantir a segurança contra fraudes e realizar análises estatísticas anônimas sobre tendências de mercado.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Segurança</h2>
            <p>
              Implementamos medidas técnicas e organizacionais avançadas para proteger seus dados contra acessos não autorizados, perda ou destruição, em conformidade com as melhores práticas de segurança da informação.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Seus Direitos</h2>
            <p>
              Você possui o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento através das configurações de perfil ou entrando em contato com nosso suporte técnico.
            </p>
          </div>
        </section>

        <footer className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 Plataforma de Produtos — Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
