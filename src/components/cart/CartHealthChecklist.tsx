/**
 * CartHealthChecklist - Painel de saúde do carrinho.
 * Substitui o "Score" abstrato por uma checklist acionável.
 */
import { useMemo, useState } from 'react';
import { type SellerCart } from '@/hooks/products';
import { Card } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Sparkles, ArrowRight, ShieldCheck, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { m as motion, AnimatePresence } from 'framer-motion';

interface CartHealthChecklistProps {
  cart: SellerCart;
  cartSubtotal: number;
  onFocusNotes?: () => void;
  onAddProducts?: () => void;
  /** Aberto por padrao? (responsivo: aberto no desktop, recolhido no tablet) */
  defaultOpen?: boolean;
}

interface CheckItem {
  id: string;
  label: string;
  ok: boolean;
  onFix?: () => void;
}

export function CartHealthChecklist({
  cart,
  cartSubtotal,
  onFocusNotes,
  onAddProducts,
  defaultOpen = true,
}: CartHealthChecklistProps) {
  const [open, setOpen] = useState(defaultOpen);
  const checks = useMemo<CheckItem[]>(() => {
    const hasMinItems = cart.items.length >= 3;
    const hasNotes = !!cart.notes && cart.notes.trim().length > 10;
    const hasMinValue = cartSubtotal >= 500;

    // Improved variant detection: if SKU is composite (contains '-'), it MUST have color_name or notes
    const hasVariants = cart.items.every((i) => {
      const isComposite = i.product_sku?.includes('-');
      if (!isComposite) return true;
      return (i.color_name && i.color_name.length > 0) || (i.notes && i.notes.length > 5);
    });

    const isReady = cart.status === 'pronto_orcamento';
    const hasItemNotes =
      cart.items.length > 0 && cart.items.every((i) => !!i.notes && i.notes.trim().length > 5);
    const noZeroPriceItems =
      cart.items.length === 0 || cart.items.every((i) => i.product_price > 0);

    return [
      { id: 'company', label: 'Empresa vinculada', ok: !!cart.company_id },
      {
        id: 'prices',
        label: 'Todos os itens com preço',
        ok: noZeroPriceItems,
        onFix: onAddProducts,
      },
      { id: 'items', label: 'Mix de produtos (≥ 3 SKUs)', ok: hasMinItems, onFix: onAddProducts },
      { id: 'value', label: 'Valor mínimo (R$ 500,00)', ok: hasMinValue, onFix: onAddProducts },
      { id: 'notes', label: 'Observações do pedido', ok: hasNotes, onFix: onFocusNotes },
      { id: 'item_notes', label: 'Instruções detalhadas por item', ok: hasItemNotes },
      { id: 'variants', label: 'Variantes e Cores', ok: hasVariants },
      { id: 'ready', label: 'Status: Pronto p/ Orçamento', ok: isReady },
    ];
  }, [cart, cartSubtotal, onFocusNotes, onAddProducts]);

  const okCount = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const pct = Math.round((okCount / total) * 100);

  return (
    <Card className="group/checklist relative overflow-hidden border-border/30 bg-gradient-to-b from-card to-card/50 p-4 shadow-sm">
      {pct === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl"
        />
      )}

      <Collapsible open={open} onOpenChange={setOpen} className="space-y-4">
        <CollapsibleTrigger className="relative z-10 flex w-full items-center justify-between gap-2 text-left">
          <span className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            {pct === 100 ? (
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 animate-pulse text-primary" />
            ) : (
              <Sparkles
                aria-hidden="true"
                className="h-3.5 w-3.5 text-primary/60 transition-colors group-hover/checklist:text-primary"
              />
            )}
            Saúde do carrinho
          </span>
          <div className="flex items-center gap-1.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={okCount}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                className={cn(
                  'text-xs font-bold tabular-nums',
                  pct >= 80 ? 'text-primary' : pct >= 50 ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {okCount}/{total}
              </motion.span>
            </AnimatePresence>
            <span className="text-[10px] font-medium text-muted-foreground opacity-40">({pct}%)</span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Saúde do carrinho: ${pct}%`}
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'circOut' }}
            className={cn(
              'relative z-10 h-full rounded-full',
              pct >= 80 ? 'bg-primary' : pct >= 50 ? 'bg-warning' : 'bg-muted-foreground/40',
            )}
          />
          {pct === 100 && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          )}
        </div>

        <CollapsibleContent className="space-y-4">
          <ul className="relative z-10 space-y-1">
            {checks.map((c, idx) => (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <button
                  type="button"
                  onClick={c.ok ? undefined : c.onFix}
                  disabled={c.ok || !c.onFix}
                  className={cn(
                    'group/item flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-all duration-200',
                    !c.ok && c.onFix && 'cursor-pointer hover:translate-x-1 hover:bg-primary/5',
                    (c.ok || !c.onFix) && 'cursor-default',
                    c.ok ? 'opacity-60' : 'opacity-100',
                  )}
                >
                  <div className="flex-shrink-0">
                    {c.ok ? (
                      <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 text-warning transition-transform group-hover/item:scale-110" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'flex-1 transition-colors',
                      c.ok
                        ? 'text-muted-foreground line-through decoration-muted-foreground/30'
                        : 'font-medium text-foreground group-hover/item:text-primary',
                    )}
                  >
                    {c.label}
                  </span>
                  {!c.ok && c.onFix && (
                    <ArrowRight aria-hidden="true" className="h-3 w-3 text-primary opacity-0 transition-opacity group-hover/item:opacity-100" />
                  )}
                </button>
              </motion.li>
            ))}
          </ul>

          {pct < 100 && (
            <p className="px-2 pt-1 text-[10px] italic text-muted-foreground/60">
              {pct >= 80
                ? 'Quase lá! Só mais um pouco...'
                : 'Complete a checklist para garantir a melhor conversão.'}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
