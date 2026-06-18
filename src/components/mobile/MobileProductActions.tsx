import React, { useState } from 'react';
import { Heart, Share2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { QuickAddToQuote } from '@/components/products/QuickAddToQuote';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import type { Product } from '@/hooks/products';

interface MobileProductActionsProps {
  productId: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productImageUrl?: string;
  minQuantity?: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShare?: () => void;
  product?: Product;
}

export const MobileProductActions = React.forwardRef<HTMLDivElement, MobileProductActionsProps>(
  function MobileProductActions(
    {
      productId,
      productName,
      productSku,
      productPrice,
      productImageUrl,
      minQuantity = 1,
      isFavorite,
      onToggleFavorite,
      onShare,
      product,
    },
    ref,
  ) {
    const navigate = useNavigate();
    const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);

    const handleShare = () => {
      if (onShare) {
        onShare();
      } else if (navigator.share) {
        navigator.share({
          title: productName,
          text: `Confira: ${productName} - ${productSku}`,
          url: window.location.href,
        });
      }
    };

    const wizardProduct: Product =
      product ||
      ({
        id: productId,
        name: productName,
        sku: productSku,
        price: productPrice,
        images: productImageUrl ? [productImageUrl] : [],
        minQuantity,
      } as Product);

    return (
      <>
        <div
          ref={ref}
          className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Favorite Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleFavorite}
              className={cn(
                'h-10 w-10 shrink-0 rounded-full transition-colors',
                isFavorite && 'border-destructive/50 bg-destructive/10 text-destructive',
              )}
              data-testid="product-favorite"
              aria-pressed={isFavorite}
              aria-label="Favoritar"
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </Button>

            {/* Share Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="h-10 w-10 shrink-0 rounded-full"
              aria-label="Compartilhar"
            >
              <Share2 className="h-4 w-4" />
            </Button>

            {/* Carrinho Button */}
            <QuickAddToQuote
              productId={productId}
              productName={productName}
              productSku={productSku}
              productImageUrl={productImageUrl}
              productPrice={productPrice}
              minQuantity={minQuantity}
              variant="button"
              buttonSize="default"
              labelOverride="Carrinho"
              iconOverride="cart"
              className="h-10 flex-1 rounded-full bg-primary text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            />

            {/* Orçamento Button */}
            <Button
              onClick={() => setQuoteWizardOpen(true)}
              className="h-10 flex-1 gap-2 rounded-full bg-success text-sm font-medium text-success-foreground transition-all hover:bg-success/90 active:scale-[0.98] disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Orçamento
            </Button>
          </div>
        </div>

        <BulkVariantWizard
          open={quoteWizardOpen}
          onOpenChange={setQuoteWizardOpen}
          products={[wizardProduct]}
          mode="quote"
          onComplete={(selections) => {
            const s = selections[0];
            const v = s?.variant;
            const params = new URLSearchParams({
              product_id: productId,
              product_name: productName,
              product_sku: productSku ?? '',
              product_price: String(productPrice),
              product_image: v?.selected_thumbnail || (productImageUrl ?? ''),
              min_quantity: String(minQuantity),
            });
            if (v?.color_name) params.set('color_name', v.color_name);
            if (v?.color_hex) params.set('color_hex', v.color_hex);
            if (v?.size_code) params.set('size_code', v.size_code);
            navigate(`/orcamentos/novo?${params}`);
          }}
        />
      </>
    );
  },
);
