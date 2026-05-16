import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LegalFooterProps {
  className?: string;
  /** Quando true, aplica borda superior separadora (uso dentro de cards). */
  withDivider?: boolean;
}

/**
 * Rodapé legal reutilizável nas telas de autenticação
 * (login, cadastro e recuperação de senha).
 *
 * - Responsivo: tipografia e espaçamento se adaptam em telas pequenas.
 * - Contraste melhorado em relação à versão anterior (text-muted-foreground/80).
 * - Inclui links clicáveis para Termos de Uso e Política de Privacidade.
 */
export function LegalFooter({ className, withDivider = true }: LegalFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "w-full space-y-3 px-2 pt-4 sm:space-y-4 sm:px-4 sm:pt-5",
        withDivider && "border-t border-white/10",
        className,
      )}
      aria-label="Rodapé legal"
    >
      <p className="mx-auto max-w-md text-center text-[11px] leading-relaxed text-muted-foreground/80 sm:text-xs">
        Este sistema é propriedade intelectual exclusiva da Brasil Marcas, sendo
        protegido pela Lei nº 9.609/98 e demais normas aplicáveis. É proibida sua
        reprodução, cópia, modificação, distribuição ou uso não autorizado.
      </p>

      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] sm:text-xs"
        aria-label="Links legais"
      >
        <Link
          to="/termos"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Termos de Uso
        </Link>
        <span aria-hidden="true" className="text-muted-foreground/40">
          •
        </span>
        <Link
          to="/privacidade"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Política de Privacidade
        </Link>
      </nav>

      <p className="text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
        © {year} Plataforma de Produtos — Todos os direitos reservados.
      </p>
    </footer>
  );
}

export default LegalFooter;
