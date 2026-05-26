import { useState } from 'react';
import { Plus, Check, ShoppingCart, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartCompanyPicker } from '@/components/cart/CartCompanyPicker';
import { SingleVariantPicker } from '@/components/products/SingleVariantPicker';
import type { ExternalVariantStock } from '@/hooks/products';

interface QuickAddToQuoteProps {
  productId: string;
  productName: string;
  productSku?: string;
  productImageUrl?: string;
  productPrice?: number;
  minQuantity?: number;
  className?: string;
  variant?: 'icon' | 'button' | 'badge';
  labelOverride?: string;
  iconOverride?: 'cart' | 'plus';
  buttonSize?: 'default' | 'sm' | 'lg' | 'xl' | 'icon';
}

export function QuickAddToQuote({
  productId,
  productName,
  productSku,
  productImageUrl,
  productPrice = 0,
  minQuantity = 1,
  className,
  variant = 'button',
  labelOverride,
  iconOverride,
  buttonSize,
}: QuickAddToQuoteProps) {
  const [quantity, setQuantity] = useState(minQuantity);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ExternalVariantStock | null | undefined>(
    undefined,
  );
  const { activeCart, addToActiveCart } = useSellerCartContext();

  const handleVariantSelect = (v: ExternalVariantStock | null) => {
    setSelectedVariant(v);
  };

  const handleAddToQuote = () => {
    addToActiveCart({
      product_id: productId,
      product_name: productName,
      product_sku: productSku,
      product_image_url: selectedVariant?.selected_thumbnail || productImageUrl,
      product_price: productPrice,
      quantity,
      color_name: selectedVariant?.color_name || undefined,
      color_hex: selectedVariant?.color_hex || undefined,
    });

    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
      setIsOpen(false);
      setQuantity(minQuantity);
      setSelectedVariant(undefined);
    }, 1200);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedVariant(undefined);
    }
  };

  const handleCompanyCreated = () => {
    // Company created, activeCart will update via context
  };

  // Whether variant has been chosen (null = skipped, undefined = not yet chosen)
  const variantChosen = selectedVariant !== undefined;
  // Need company picker if variant chosen but no active cart
  const needsCompanyPicker = variantChosen && !activeCart;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {variant === 'badge' ? (
          <Badge
            variant="outline"
            className={cn(
              'cursor-pointer px-2.5 py-1 text-sm font-medium',
              'border-primary/50 bg-primary/10 hover:bg-primary/20',
              'text-primary hover:text-primary/80',
              'transition-all duration-200 hover:scale-105 hover:border-primary',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
            <span className="text-xs">Orçar</span>
          </Badge>
        ) : variant === 'icon' ? (
          <Button
            variant="secondary"
            size="icon"
            aria-label="ShoppingCart"
            className={cn(
              'h-10 w-10 rounded-full border border-border/50 bg-card/95 text-foreground shadow-lg backdrop-blur-md',
              'transition-all duration-200 hover:scale-110 hover:bg-primary hover:text-primary-foreground',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        ) : (
          <Button size={buttonSize} className={cn(className)} onClick={(e) => e.stopPropagation()}>
            {iconOverride === 'cart' ? (
              <ShoppingBag className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {labelOverride || 'Orçar'}
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        className="relative w-80 p-4"
        align="end"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Fechar"
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Step 1: Variant selection */}
        {!variantChosen ? (
          <div className="space-y-3">
            <div>
              <h4 className="mb-1 pr-6 text-sm font-medium">Escolha a cor</h4>
              <p className="line-clamp-1 text-xs text-muted-foreground">{productName}</p>
            </div>
            <SingleVariantPicker productId={productId} onSelect={handleVariantSelect} compact />
          </div>
        ) : needsCompanyPicker ? (
          /* Step 2: Company picker (only if no active cart) */
          <CartCompanyPicker onCreated={handleCompanyCreated} onCancel={() => setIsOpen(false)} />
        ) : (
          /* Step 3: Quantity + Add */
          <div className="space-y-3">
            <div>
              <h4 className="mb-1 pr-6 text-sm font-medium">Adicionar ao carrinho</h4>
              <p className="line-clamp-1 text-xs text-muted-foreground">{productName}</p>
              {activeCart && (
                <p className="mt-1 truncate text-[10px] font-medium text-primary">
                  → {activeCart.company_name}
                </p>
              )}
            </div>

            {/* Selected variant summary */}
            {selectedVariant && (
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/40 p-2">
                {selectedVariant.selected_thumbnail ? (
                  <img
                    src={`${selectedVariant.selected_thumbnail}/thumbnail`}
                    alt={selectedVariant.color_name ?? ''}
                    className="h-7 w-7 rounded-md border border-border/50 object-cover"
                  />
                ) : selectedVariant.color_hex ? (
                  <div
                    className="h-7 w-7 rounded-md border border-border/50"
                    style={{ backgroundColor: selectedVariant.color_hex }}
                  />
                ) : null}
                <span className="flex-1 truncate text-xs font-medium">
                  {selectedVariant.color_name}
                  {selectedVariant.size_code && ` — ${selectedVariant.size_code}`}
                </span>
                <button
                  onClick={() => setSelectedVariant(undefined)}
                  className="shrink-0 text-[10px] text-primary hover:underline"
                >
                  Trocar
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Quantidade</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity(Math.max(minQuantity, quantity - 10))}
                  aria-label="Diminuir quantidade"
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={minQuantity}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(minQuantity, parseInt(e.target.value) || minQuantity))
                  }
                  className="h-8 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity(quantity + 10)}
                  aria-label="Aumentar quantidade"
                >
                  +
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Mínimo: {minQuantity} un.</p>
            </div>

            <Button
              data-testid="product-card-add-to-cart"
              className="w-full gap-2"
              onClick={handleAddToQuote}
              disabled={isAdded || !activeCart}
            >
              {isAdded ? (
                <>
                  <Check className="h-4 w-4" />
                  Adicionado!
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Adicionar ao Carrinho
                </>
              )}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
