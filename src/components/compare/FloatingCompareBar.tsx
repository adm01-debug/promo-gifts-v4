import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCompare, X, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useComparisonStore, type CompareVariantInfo } from '@/stores/useComparisonStore';
import { useProductsContextSafe } from '@/contexts/ProductsContext';
import type { Product } from '@/types/product-catalog';
import { cn } from '@/lib/utils';

export const FloatingCompareBar = React.forwardRef<HTMLDivElement>(
  function FloatingCompareBar(_props, _ref) {
    const navigate = useNavigate();
    const { compareItems, removeByIndex, clearCompare, compareCount } = useComparisonStore();
    const ctx = useProductsContextSafe();
    const getProductsByIds = ctx?.getProductsByIds;
    const cacheSignal = ctx?.products;

    const compareEntries = useMemo(() => {
      if (!getProductsByIds) return [];
      const uniqueIds = [...new Set(compareItems.map((i) => i.productId))];
      const productMap = new Map<string, Product>();
      getProductsByIds(uniqueIds).forEach((p: Product) => productMap.set(p.id, p));

      return compareItems
        .map((item, index) => {
          const product = productMap.get(item.productId);
          if (!product) return null;
          const displayProduct = item.variant?.thumbnail
            ? { ...product, images: [item.variant.thumbnail, ...product.images] }
            : product;
          return { product: displayProduct, variant: item.variant, index };
        })
        .filter(Boolean) as Array<{
        product: Product;
        variant?: CompareVariantInfo;
        index: number;
      }>;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compareItems, getProductsByIds, cacheSignal]);

    if (compareCount === 0) return null;

    return (
      <div
        className={cn(
          'fixed bottom-20 left-1/2 z-40 -translate-x-1/2 sm:bottom-24 lg:bottom-6',
          'rounded-2xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl',
          'flex items-center gap-3 px-4 py-3',
          'max-w-[95vw] sm:max-w-xl',
          'duration-300 animate-in fade-in slide-in-from-bottom-24',
        )}
      >
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <GitCompare className="h-5 w-5 text-primary" />
        </div>

        {/* Product Thumbnails */}
        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {compareEntries.map((entry, idx) => (
            <div
              key={`cmp-${entry.index}`}
              className="group relative flex-shrink-0 duration-200 animate-in fade-in zoom-in-0"
              style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-12 w-12 cursor-pointer overflow-hidden rounded-lg border-2 border-border/50 bg-muted transition-colors hover:border-primary/50">
                    <img
                      src={entry.product.images[0]}
                      alt={entry.product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="truncate font-medium">
                    {entry.product.name}
                    {entry.variant?.color_name && ` — ${entry.variant.color_name}`}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Remove button */}
              <button
                onClick={() => removeByIndex(entry.index)}
                className={cn(
                  'absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full',
                  'bg-destructive text-destructive-foreground',
                  'flex items-center justify-center',
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  'hover:bg-destructive/90',
                )}
              >
                <X className="h-3 w-3" />
              </button>

              {/* Color dot indicator */}
              {entry.variant?.color_hex && (
                <div
                  className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-card"
                  style={{ backgroundColor: entry.variant.color_hex }}
                />
              )}
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 4 - compareCount }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border/50"
            >
              <span className="text-xs text-muted-foreground">+</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-8 w-px flex-shrink-0 bg-border" />

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={clearCompare}
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar comparação</TooltipContent>
          </Tooltip>

          <Button
            variant="orange"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/comparar')}
            disabled={compareCount < 2}
          >
            Comparar
            <span className="rounded-md bg-brand-primary-foreground/20 px-1.5 py-0.5 text-xs">
              {compareCount}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  },
);
