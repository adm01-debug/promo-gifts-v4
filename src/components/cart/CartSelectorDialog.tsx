/**
 * CartSelectorDialog - Dialogo para o vendedor escolher em qual carrinho adicionar o produto.
 * Exibido quando há múltiplos carrinhos ativos.
 */
import { Building2, ShoppingCart, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SellerCart } from '@/hooks/products';

interface CartSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carts: SellerCart[];
  productName: string;
  onSelect: (cartId: string) => void;
  onCreateNew: () => void;
  canCreateMore: boolean;
}

export function CartSelectorDialog({
  open,
  onOpenChange,
  carts = [],
  productName,
  onSelect,
  onCreateNew,
  canCreateMore,
}: CartSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" data-testid="cart-selector-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Escolher Carrinho
          </DialogTitle>
          <DialogDescription className="text-xs">
            {carts.length === 1
              ? 'Você tem 1 carrinho ativo. Escolha-o ou crie um novo para outro cliente para adicionar '
              : `Você tem ${carts.length} carrinhos ativos. Em qual deseja adicionar `}
            <span className="font-semibold text-foreground">{productName}</span>?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="mt-2 max-h-[300px] pr-3">
          <div className="space-y-2 py-1">
            {carts.map((cart) => (
              <button
                key={cart.id}
                type="button"
                onClick={() => onSelect(cart.id)}
                data-testid={`cart-selector-item-${cart.id}`}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-card p-3 text-left transition-all',
                  'hover:border-primary/40 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]',
                )}
              >
                {cart.company_logo_url ? (
                  <img
                    src={cart.company_logo_url}
                    alt=""
                    className="h-10 w-10 rounded-full border border-border/40 bg-background object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold group-hover:text-primary">
                    {cart.company_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {cart.items.length} {cart.items.length === 1 ? 'item' : 'itens'} no momento
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 flex flex-col gap-2">
          {canCreateMore && (
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={onCreateNew}
              data-testid="cart-selector-create-new"
            >
              <Plus className="h-4 w-4" />
              Criar novo carrinho para outra empresa
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
