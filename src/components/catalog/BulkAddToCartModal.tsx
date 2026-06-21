/**
 * BulkAddToCartModal — Modal para adicionar múltiplos produtos ao carrinho.
 * Aceita seleções de variantes do BulkVariantWizard.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, ShoppingBag, Loader2 } from 'lucide-react';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartCompanyPicker } from '@/components/cart/CartCompanyPicker';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Product } from '@/hooks/products';
import type { BulkVariantSelection } from './BulkVariantWizard';

interface BulkAddToCartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  variantSelections?: BulkVariantSelection[];
  onDone?: () => void;
}

export function BulkAddToCartModal({
  open,
  onOpenChange,
  products,
  variantSelections,
  onDone,
}: BulkAddToCartModalProps) {
  const { activeCart, addToActiveCart } = useSellerCartContext();
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setAdding(false);
      setDone(false);
    }
  }, [open]);

  const handleAdd = useCallback(() => {
    if (!activeCart) return;

    const items =
      variantSelections && variantSelections.length > 0
        ? variantSelections
        : products.map((p) => ({ product: p, variant: null }));

    if (items.length === 0) return;
    setAdding(true);
    try {
      // Aguarda TODAS as adições e conta sucessos reais — antes o loop era
      // fire-and-forget e exibia "N adicionados" mesmo que inserts falhassem
      // (rede/constraint), enganando o vendedor. addToActiveCart nunca rejeita.
      const results = await Promise.all(
        items.map((item) => {
          const p = item.product;
          const v = item.variant;
          // silent: mostramos um único toast agregado após o loop.
          return addToActiveCart(
            {
              product_id: p.id,
              product_name: p.name,
              product_sku: p.sku || undefined,
              product_image_url: v?.selected_thumbnail || p.images?.[0] || undefined,
              // ?? 0: produtos externos/leves podem não ter preço; sem o guard o
              // insert gravaria undefined e poluiria todos os subtotais com NaN.
              product_price: p.price ?? 0,
              // Respeita o MOQ do produto (minQuantity), como todos os outros
              // caminhos de add (ProductCard etc.); antes fixava 1 e violava o MOQ.
              quantity: p.minQuantity || 1,
              color_name: v?.color_name || undefined,
              color_hex: v?.color_hex || undefined,
            },
            undefined,
            { silent: true },
          );
        }),
      );

      const added = results.filter(Boolean).length;
      const failed = results.length - added;

      if (added > 0 && mountedRef.current) setDone(true);

      if (failed === 0) {
        toast.success(
          `${added} produto${added > 1 ? 's' : ''} adicionado${added > 1 ? 's' : ''} ao carrinho`,
          { description: activeCart.company_name },
        );
      } else if (added > 0) {
        toast.warning(`${added} adicionado(s), ${failed} não puderam ser adicionados`, {
          description: activeCart.company_name,
        });
      } else {
        toast.error('Não foi possível adicionar os produtos ao carrinho');
      }

      // Só agenda o fechamento se ao menos um item entrou (senão o usuário fica
      // sem feedback acionável e o modal some).
      if (added > 0) {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            onOpenChange(false);
            onDone?.();
          }
        }, 1000);
      }
    } catch (err) {
      logger.error('[BulkAddToCartModal] addToActiveCart failed', err);
      toast.error('Erro ao adicionar produtos ao carrinho');
    } finally {
      if (mountedRef.current) setAdding(false);
    }
  }, [activeCart, products, variantSelections, addToActiveCart, onOpenChange, onDone]);

  const hasCart = !!activeCart;
  const count = variantSelections?.length || products.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-cart" />
            Adicionar {count} produto{count > 1 ? 's' : ''} ao carrinho
          </DialogTitle>
        </DialogHeader>

        {!hasCart ? (
          <CartCompanyPicker onCreated={() => {}} onCancel={() => onOpenChange(false)} />
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
              <p className="mb-1 text-xs text-muted-foreground">Carrinho ativo</p>
              <p className="text-sm font-medium">{activeCart.company_name}</p>
            </div>

            {/* Show variant selections summary */}
            {variantSelections && variantSelections.some((s) => s.variant) && (
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {variantSelections.map((s) => (
                  <div
                    key={s.product.id}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="flex-1 truncate">{s.product.name}</span>
                    {s.variant ? (
                      <span className="shrink-0 font-medium text-foreground">
                        {s.variant.color_name}
                        {s.variant.size_code && ` — ${s.variant.size_code}`}
                      </span>
                    ) : (
                      <span className="shrink-0 text-muted-foreground/60">Sem cor</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {count} produto{count > 1 ? 's' : ''} será{count > 1 ? 'ão' : ''} adicionado
              {count > 1 ? 's' : ''} na quantidade mínima de cada produto.
            </div>

            <Button className="w-full gap-2" onClick={handleAdd} disabled={adding || done}>
              {done ? (
                <>
                  <Check className="h-4 w-4" />
                  Adicionado!
                </>
              ) : adding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Adicionar ao Carrinho
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
