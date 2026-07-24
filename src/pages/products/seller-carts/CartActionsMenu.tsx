/**
 * CartActionsMenu — botão "..." que agrupa "Gerar Orçamento" e "Excluir"
 * do header do carrinho ativo. Acessibilidade delegada ao Radix DropdownMenu:
 * aria-expanded, navegação por setas, Enter para acionar, Escape para fechar
 * e foco de retorno para o trigger ao fechar já saem prontos.
 */
import { MoreHorizontal, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CartActionsMenuProps {
  canGenerateQuote: boolean;
  onGenerateQuote: () => void;
  onDelete: () => void;
}

export function CartActionsMenu({
  canGenerateQuote,
  onGenerateQuote,
  onDelete,
}: CartActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Mais ações do carrinho"
          data-testid="cart-actions-menu"
          className="h-9 w-9 rounded-full border-primary/30 text-primary transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          disabled={!canGenerateQuote}
          onSelect={() => {
            if (canGenerateQuote) onGenerateQuote();
          }}
          data-testid="cart-actions-generate-quote"
          className="cursor-pointer font-semibold text-success focus:bg-success/10 focus:text-success"
        >
          <ArrowRight aria-hidden="true" className="mr-2 h-4 w-4" />
          Gerar Orçamento
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete()}
          data-testid="cart-actions-delete"
          className="cursor-pointer font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
