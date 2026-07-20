/**
 * Table row action buttons — extracted from ProductTableView
 */
import { Heart, GitCompare, Share2, FolderPlus, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuickAddToQuote } from '../QuickAddToQuote';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/products';
import type { VariantActionMode } from '../VariantPickerDialog';
import { showUndoToast } from '@/utils/undoToast';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartSelectorDialog } from '@/components/cart/CartSelectorDialog';
import { useState, useCallback } from 'react';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';

interface TableRowActionsProps {
  product: Product;
  isFavorite: boolean;
  isInCompare: boolean;
  canAddToCompare: boolean;
  onToggleFavorite?: (id: string) => void;
  onToggleCompare?: (id: string) => { added: boolean; isFull: boolean } | undefined;
  onOpenVariantPicker: (product: Product, mode: VariantActionMode) => void;
  onOpenQuickView: (product: Product) => void;
}

export function TableRowActions({
  product,
  isFavorite: fav,
  isInCompare: inComp,
  canAddToCompare,
  onToggleFavorite,
  onToggleCompare,
  onOpenVariantPicker,
  onOpenQuickView,
}: TableRowActionsProps) {
  const { carts, addToActiveCart, canCreateCart } = useSellerCartContext();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingVariant, setPendingVariant] = useState<ExternalVariantStock | null>(null);

  const handleCartAdd = useCallback(
    (variant: ExternalVariantStock | null) => {
      if (carts.length > 1) {
        setPendingVariant(variant);
        setSelectorOpen(true);
        return;
      }

      addToActiveCart(
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku || undefined,
          product_image_url: variant?.selected_thumbnail || product.images?.[0],
          product_price: product.price ?? 0,
          quantity: product.minQuantity || 1,
          color_name: variant?.color_name || undefined,
          color_hex: variant?.color_hex || undefined,
        },
        carts.length === 1 ? carts[0].id : undefined,
      );
    },
    [carts, product, addToActiveCart],
  );

  return (
    <div className="flex items-center justify-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
      {/* 1 - Carrinho */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div onClick={(e) => e.stopPropagation()}>
            <QuickAddToQuote
              productId={product.id}
              productName={product.name}
              productSku={product.sku}
              productImageUrl={
                product.primary_image_url || product.og_image_url || product.images?.[0]
              }
              productPrice={product.price}
              minQuantity={product.minQuantity || 1}
              variant="icon"
              className="h-6 w-6"
              onSuccess={handleCartAdd}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">Adicionar ao Carrinho</TooltipContent>
      </Tooltip>

      {/* 2 - Orçamento */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-success hover:text-success-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVariantPicker(product, 'quote');
            }}
            aria-label="Orçamento"
          >
            <FileText className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Orçamento</TooltipContent>
      </Tooltip>

      {/* 3 - Coleção */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVariantPicker(product, 'collection');
            }}
            aria-label="Coleção"
          >
            <FolderPlus className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Coleção</TooltipContent>
      </Tooltip>

      {/* 4 - Favoritar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-6 w-6 shrink-0 rounded-full',
              fav && 'bg-destructive/10 text-destructive',
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (fav) {
                onToggleFavorite?.(product.id);
                showUndoToast({
                  title: `"${product.name}" removido dos favoritos`,
                  onUndo: () => onToggleFavorite?.(product.id),
                });
              } else {
                onOpenVariantPicker(product, 'favorite');
              }
            }}
            aria-label="Favoritar"
            data-testid="product-favorite"
            aria-pressed={fav}
          >
            <Heart className={cn('h-3 w-3', fav && 'fill-current')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{fav ? 'Remover favorito' : 'Favoritar'}</TooltipContent>
      </Tooltip>

      {/* 5 - Comparar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 shrink-0 rounded-full', inComp && 'bg-primary/10 text-primary')}
            disabled={!inComp && !canAddToCompare}
            onClick={(e) => {
              e.stopPropagation();
              if (inComp) {
                onToggleCompare?.(product.id);
                showUndoToast({
                  title: `"${product.name}" removido da comparação`,
                  onUndo: () => {
                    onToggleCompare?.(product.id);
                  },
                });
              } else {
                onOpenVariantPicker(product, 'compare');
              }
            }}
            aria-label="Comparar"
          >
            <GitCompare className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Comparar</TooltipContent>
      </Tooltip>

      {/* 6 - Quick View */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onOpenQuickView(product);
            }}
            aria-label="Quick View"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Quick View</TooltipContent>
      </Tooltip>

      {/* 7 - Compartilhar */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVariantPicker(product, 'share');
            }}
            aria-label="Compartilhar"
          >
            <Share2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Compartilhar</TooltipContent>
      </Tooltip>

      <CartSelectorDialog
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        carts={carts}
        productName={product.name}
        canCreateMore={canCreateCart}
        onSelect={(cartId) => {
          addToActiveCart(
            {
              product_id: product.id,
              product_name: product.name,
              product_sku: product.sku || undefined,
              product_image_url: pendingVariant?.selected_thumbnail || product.images?.[0],
              product_price: product.price ?? 0,
              quantity: product.minQuantity || 1,
              color_name: pendingVariant?.color_name || undefined,
              color_hex: pendingVariant?.color_hex || undefined,
            },
            cartId,
          );
          setSelectorOpen(false);
          setPendingVariant(null);
        }}
        onCreateNew={() => {
          setSelectorOpen(false);
          setPendingVariant(null);
        }}
      />
    </div>
  );
}
