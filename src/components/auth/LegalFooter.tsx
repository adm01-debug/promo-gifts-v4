// LegalFooter usa <a> nativo para abrir os links legais em nova aba,
// preservando o estado do formulário de login. Não usar <Link> aqui.
import { cn } from '@/lib/utils';

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
 * - Links abrem em nova aba (target="_blank") para não interromper o login.
 */
export function LegalFooter({ className, withDivider = true }: LegalFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        '-mt-4 w-full space-y-1.5 px-2 pt-1 sm:-mt-6 sm:space-y-2 sm:px-4 sm:pt-2',
        withDivider && 'border-t border-white/10',
        className,
      )}
      aria-label="Rodapé legal"
    >
      <p className="mx-auto max-w-md text-center text-[9px] leading-relaxed text-white/50 opacity-90 sm:text-[10px]">
        Este sistema é propriedade intelectual exclusiva da Brasil Marcas, sendo protegido pela Lei
        nº 9.609/98 e demais normas aplicáveis. É proibida sua reprodução, cópia, modificação,
        distribuição ou uso não autorizado.
      </p>

      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px] opacity-90 sm:text-[10px]"
        aria-label="Links legais"
      >
        <a
          href="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded font-medium text-white/60 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#030508]"
        >
          Termos de Uso
        </a>
        <span aria-hidden="true" className="text-white/20">
          •
        </span>
        <a
          href="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded font-medium text-white/60 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#030508]"
        >
          Política de Privacidade
        </a>
      </nav>

      <p className="text-center text-[9px] font-medium text-white/40 opacity-90 sm:text-[10px]">
        © {year} Promo Brindes — Todos os direitos reservados.
      </p>
    </footer>
  );
}

export default LegalFooter;
