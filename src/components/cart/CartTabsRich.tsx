/**
 * CartTabsRich - Tabs de carrinhos com status dot colorido, contador inteligente,
 * indicador de follow-up e botão "+" para criar novo.
 */
import { useRef, useCallback, useState } from 'react';
import { type SellerCart } from '@/hooks/products';
import { Building2, Plus, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays } from 'date-fns';
import { getStatusCfg } from '@/components/cart/CartUtilComponents';
import { Skeleton } from '@/components/ui/skeleton';
import { m as motion } from 'framer-motion';
import { MAX_SELLER_CARTS, SELLER_CART_LIMIT_REACHED_SHORT } from '@/hooks/products/useSellerCarts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CartTabsRichProps {
  carts: SellerCart[];
  activeCartId: string | null;
  canCreateCart: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading?: boolean;
}

export function CartTabsRich({
  carts,
  activeCartId,
  canCreateCart,
  onSelect,
  onNew,
  isLoading,
}: CartTabsRichProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const [limitDetailsOpen, setLimitDetailsOpen] = useState(false);


  // WCAG 2.1 AA: arrow key navigation for role="tablist" (roving tabindex pattern)
  const handleTablistKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const tabs = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      if (!tabs || tabs.length === 0) return;
      const current = Array.from(tabs).findIndex((t) => t === document.activeElement);
      let next = current;
      if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      tabs[next]?.focus();
      const cartId = tabs[next]?.dataset.cartId;
      if (cartId) onSelect(cartId);
    },
    [onSelect],
  );

  if (isLoading) {
    return (
      <div className="flex animate-pulse gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex w-[180px] flex-shrink-0 items-center gap-2.5 rounded-xl border border-border/30 bg-muted/5 px-3.5 py-2"
          >
            <Skeleton className="h-7 w-7 rounded-lg opacity-40" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-2/3 opacity-30" />
              <Skeleton className="h-2 w-1/3 opacity-20" />
            </div>
            <Skeleton className="h-5 w-5 rounded-full opacity-30" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* tablist contains ONLY role="tab" children — "Novo" button lives outside to satisfy WCAG 4.1.2 */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Carrinhos"
        onKeyDown={handleTablistKeyDown}
        className="scrollbar-none flex min-w-0 flex-1 snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2"
      >
        {carts.map((cart) => {
          const isActive = cart.id === activeCartId;
          const statusCfg = getStatusCfg(cart.status);
          const ageDays = differenceInDays(new Date(), new Date(cart.created_at));
          const needsFollowUp =
            ageDays >= 3 && cart.items.length > 0 && cart.status !== 'pronto_orcamento';
          const hasItems = cart.items.length > 0;
          return (
            <button
              key={cart.id}
              onClick={() => onSelect(cart.id)}
              data-testid="cart-tab"
              data-cart-id={cart.id}
              data-active={isActive ? 'true' : 'false'}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                'group relative flex flex-shrink-0 snap-start items-center gap-3 whitespace-nowrap rounded-2xl border px-4 py-2.5 transition-all duration-500 animate-in fade-in slide-in-from-left-4',
                isActive
                  ? 'z-10 scale-[1.03] border-primary/40 bg-primary/10 text-primary shadow-lg ring-2 ring-primary/10'
                  : 'border-border/30 bg-card shadow-sm hover:translate-y-[-1px] hover:border-border/60 hover:bg-muted/30',
              )}
            >
              <div
                className={cn(
                  'absolute inset-x-4 -bottom-[1px] h-0.5 rounded-full bg-primary transition-all duration-500',
                  isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                )}
              />
              {cart.company_logo_url ? (
                <img
                  src={cart.company_logo_url}
                  alt=""
                  className="h-8 w-8 flex-shrink-0 rounded-full border border-border/40 bg-background object-cover transition-transform group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div
                  className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                  )}
                >
                  <Building2 aria-hidden="true" className="h-4 w-4" />
                </div>
              )}
              <div className="flex flex-col items-start gap-0.5 leading-none">
                <span className="max-w-[150px] truncate text-sm font-bold tracking-tight transition-colors group-hover:text-primary">
                  {cart.company_name}
                </span>
                <div className="flex items-center gap-2 opacity-80">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shadow-sm ring-2 ring-background',
                      statusCfg.color.split(' ')[0],
                    )}
                    aria-hidden
                  />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground opacity-60">
                    {statusCfg.label}
                  </span>
                </div>
              </div>
              <span
                data-testid="cart-tab-count"
                data-count={cart.items.length}
                className={cn(
                  'ml-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-[10px] font-black tabular-nums transition-all duration-500',
                  hasItems
                    ? isActive
                      ? 'scale-110 bg-primary text-primary-foreground shadow-lg'
                      : 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground opacity-50',
                )}
              >
                {cart.items.length}
              </span>
              {needsFollowUp && (
                <motion.span
                  data-testid="cart-tab-followup"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-warning text-warning-foreground shadow-md"
                  title={`Follow-up sugerido — criado há ${ageDays} dias`}
                >
                  <Clock aria-hidden="true" className="h-3 w-3" />
                </motion.span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 pb-2 pr-1">
        <button
          data-testid="cart-tab-new"
          onClick={canCreateCart ? onNew : undefined}
          disabled={!canCreateCart}
          title={
            !canCreateCart
              ? `${SELLER_CART_LIMIT_REACHED_SHORT} (${carts.length}/${MAX_SELLER_CARTS}). Exclua um carrinho para criar outro.`
              : `Criar novo carrinho (${carts.length}/${MAX_SELLER_CARTS})`
          }
          className={cn(
            'group/new flex items-center gap-2 rounded-2xl border-2 border-dashed px-5 py-2.5 transition-all',
            canCreateCart
              ? 'border-border/40 text-muted-foreground/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95'
              : 'cursor-not-allowed border-border/20 text-muted-foreground/30 opacity-50',
            'text-sm font-bold',
          )}
          aria-label={canCreateCart ? 'Criar novo carrinho' : SELLER_CART_LIMIT_REACHED_SHORT}
        >
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-lg bg-muted/40 transition-colors',
              canCreateCart && 'group-hover/new:bg-primary/20',
            )}
          >
            <Plus
              aria-hidden="true"
              className={cn(
                'h-4 w-4 transition-transform duration-300',
                canCreateCart && 'group-hover/new:rotate-90',
              )}
            />
          </div>
          <span>Novo</span>
          <span
            data-testid="cart-tab-new-counter"
            className={cn(
              'ml-1 inline-flex min-w-[2.5rem] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
              canCreateCart
                ? 'border-border/40 bg-muted/20 text-muted-foreground'
                : 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
            aria-label={`${carts.length} de ${MAX_SELLER_CARTS} carrinhos usados`}
          >
            {carts.length}/{MAX_SELLER_CARTS}
          </span>
        </button>
      </div>
    </div>
  );
}
