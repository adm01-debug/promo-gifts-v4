/**
 * Mobile Summary Bottom Sheet for cart
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { m as motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronUp } from 'lucide-react';
import type { SellerCart } from '@/hooks/products';
import { formatCurrency } from '../CartUtilComponents';

export function MobileSummarySheet({
  cart,
  subtotal,
  totalQty,
  onGenerateQuote,
}: {
  cart: SellerCart;
  subtotal: number;
  totalQty: number;
  onGenerateQuote: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (cart.items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <motion.div
        className="rounded-t-2xl border-t border-border bg-card shadow-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Recolher resumo do carrinho' : 'Expandir resumo do carrinho'}
          className="flex w-full items-center justify-between px-5 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              {cart.items.length} SKUs • {totalQty} un.
            </span>
            <span className="text-sm font-bold tabular-nums text-primary">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <ChevronUp
            aria-hidden="true"
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-5 pb-3"
            >
              <div className="mb-3 space-y-2 text-xs">
                {cart.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="mr-2 flex-1 truncate">{item.product_name}</span>
                    <span className="tabular-nums text-muted-foreground">{item.quantity}x</span>
                  </div>
                ))}
                {cart.items.length > 5 && (
                  <p className="text-muted-foreground">+{cart.items.length - 5} itens</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-5 pb-1">
          <Button
            data-testid="cart-checkout-cta"
            className="h-11 w-full gap-2 rounded-xl bg-success font-semibold text-success-foreground shadow-md shadow-success/20 transition-all duration-300 hover:scale-[1.02] hover:bg-success/90 hover:shadow-lg hover:shadow-success/30 active:scale-[0.98]"
            onClick={onGenerateQuote}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            Gerar Orçamento
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
