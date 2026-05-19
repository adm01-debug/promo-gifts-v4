import { useState } from "react";
import { Plus, Check, ShoppingCart, ShoppingBag, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSellerCartContext } from "@/contexts/SellerCartContext";
import { CartCompanyPicker } from "@/components/cart/CartCompanyPicker";
import { SingleVariantPicker } from "@/components/products/SingleVariantPicker";
import type { ExternalVariantStock } from "@/hooks/products";

interface QuickAddToQuoteProps {
  productId: string;
  productName: string;
  productSku?: string;
  productImageUrl?: string;
  productPrice?: number;
  minQuantity?: number;
  className?: string;
  variant?: "icon" | "button" | "badge";
  labelOverride?: string;
  iconOverride?: "cart" | "plus";
  buttonSize?: "default" | "sm" | "lg" | "xl" | "icon";
}

export function QuickAddToQuote({
  productId,
  productName,
  productSku,
  productImageUrl,
  productPrice = 0,
  minQuantity = 1,
  className,
  variant = "button",
  labelOverride,
  iconOverride,
  buttonSize,
}: QuickAddToQuoteProps) {
  const [quantity, setQuantity] = useState(minQuantity);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ExternalVariantStock | null | undefined>(undefined);
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
        {variant === "badge" ? (
          <Badge
            variant="outline"
            className={cn(
              "px-2.5 py-1 text-sm font-medium cursor-pointer",
              "border-primary/50 bg-primary/10 hover:bg-primary/20",
              "text-primary hover:text-primary/80",
              "transition-all duration-200 hover:scale-105 hover:border-primary",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs">Orçar</span>
          </Badge>
        ) : variant === "icon" ? (
          <Button
            variant="secondary"
            size="icon"
            aria-label="ShoppingCart"
            className={cn(
              "h-10 w-10 rounded-full bg-card/95 backdrop-blur-md shadow-lg border border-border/50 text-foreground",
              "hover:bg-primary hover:text-primary-foreground hover:scale-110 transition-all duration-200",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size={buttonSize}
            className={cn(className)}
            onClick={(e) => e.stopPropagation()}
          >
            {iconOverride === "cart" ? <ShoppingBag className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {labelOverride || "Orçar"}
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 relative" align="end" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          aria-label="Fechar"
          className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Step 1: Variant selection */}
        {!variantChosen ? (
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-1 pr-6">Escolha a cor</h4>
              <p className="text-xs text-muted-foreground line-clamp-1">{productName}</p>
            </div>
            <SingleVariantPicker
              productId={productId}
              onSelect={handleVariantSelect}
              compact
            />
          </div>
        ) : needsCompanyPicker ? (
          /* Step 2: Company picker (only if no active cart) */
          <CartCompanyPicker onCreated={handleCompanyCreated} onCancel={() => setIsOpen(false)} />
        ) : (
          /* Step 3: Quantity + Add */
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-1 pr-6">Adicionar ao carrinho</h4>
              <p className="text-xs text-muted-foreground line-clamp-1">{productName}</p>
              {activeCart && (
                <p className="text-[10px] text-primary mt-1 font-medium truncate">→ {activeCart.company_name}</p>
              )}
            </div>

            {/* Selected variant summary */}
            {selectedVariant && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border/50">
                {selectedVariant.selected_thumbnail ? (
                  <img
                    src={`${selectedVariant.selected_thumbnail}/thumbnail`}
                    alt={selectedVariant.color_name ?? ''}
                    className="w-7 h-7 rounded-md object-cover border border-border/50"
                  />
                ) : selectedVariant.color_hex ? (
                  <div className="w-7 h-7 rounded-md border border-border/50" style={{ backgroundColor: selectedVariant.color_hex }} />
                ) : null}
                <span className="text-xs font-medium flex-1 truncate">
                  {selectedVariant.color_name}
                  {selectedVariant.size_code && ` — ${selectedVariant.size_code}`}
                </span>
                <button
                  onClick={() => setSelectedVariant(undefined)}
                  className="text-[10px] text-primary hover:underline shrink-0"
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
                  onChange={(e) => setQuantity(Math.max(minQuantity, parseInt(e.target.value) || minQuantity))}
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

            <Button data-testid="product-card-add-to-cart" className="w-full gap-2" onClick={handleAddToQuote} disabled={isAdded || !activeCart}>
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
