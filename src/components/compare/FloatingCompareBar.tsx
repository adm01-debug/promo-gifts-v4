import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { GitCompare, X, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useComparisonStore, type CompareVariantInfo } from "@/stores/useComparisonStore";
import { useProductsContextSafe } from "@/contexts/ProductsContext";
import type { Product } from "@/types/product-catalog";
import { cn } from "@/lib/utils";

export const FloatingCompareBar = React.forwardRef<HTMLDivElement>(
  function FloatingCompareBar(_props, ref) {
  const navigate = useNavigate();
  const { compareItems, removeByIndex, clearCompare, compareCount } =
    useComparisonStore();
  const ctx = useProductsContextSafe();
  const getProductsByIds = ctx?.getProductsByIds;
  const cacheSignal = ctx?.products;

  const compareEntries = useMemo(() => {
    if (!getProductsByIds) return [];
    const uniqueIds = [...new Set(compareItems.map(i => i.productId))];
    const productMap = new Map<string, Product>();
    getProductsByIds(uniqueIds).forEach((p: Product) => productMap.set(p.id, p));

    return compareItems.map((item, index) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      const displayProduct = item.variant?.thumbnail
        ? { ...product, images: [item.variant.thumbnail, ...product.images] }
        : product;
      return { product: displayProduct, variant: item.variant, index };
    }).filter(Boolean) as { product: Product; variant?: CompareVariantInfo; index: number }[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareItems, getProductsByIds, cacheSignal]);

  if (compareCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={cn(
          "fixed bottom-20 sm:bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-40",
          "bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl",
          "px-4 py-3 flex items-center gap-3",
          "max-w-[95vw] sm:max-w-xl"
        )}
      >
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <GitCompare className="h-5 w-5 text-primary" />
        </div>

        {/* Product Thumbnails */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {compareEntries.map((entry, idx) => (
            <motion.div
              key={`cmp-${entry.index}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative flex-shrink-0 group"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-border/50 bg-muted cursor-pointer hover:border-primary/50 transition-colors">
                    <img
                      src={entry.product.images[0]}
                      alt={entry.product.name}
                      className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="font-medium truncate">
                    {entry.product.name}
                    {entry.variant?.color_name && ` — ${entry.variant.color_name}`}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Remove button */}
              <button
                onClick={() => removeByIndex(entry.index)}
                className={cn(
                  "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full",
                  "bg-destructive text-destructive-foreground",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-destructive/90"
                )}
              >
                <X className="h-3 w-3" />
              </button>

              {/* Color dot indicator */}
              {entry.variant?.color_hex && (
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card"
                  style={{ backgroundColor: entry.variant.color_hex }}
                />
              )}
            </motion.div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 4 - compareCount }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center flex-shrink-0"
            >
              <span className="text-xs text-muted-foreground">+</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border flex-shrink-0" />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                onClick={clearCompare}
               aria-label="Excluir"><Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Limpar comparação</TooltipContent>
          </Tooltip>

          <Button
            variant="orange"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/comparar")}
            disabled={compareCount < 2}
          >
            Comparar
            <span className="text-xs bg-orange-foreground/20 px-1.5 py-0.5 rounded-md">
              {compareCount}
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
  }
);
