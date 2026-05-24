import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRecentlyViewedStore } from "@/stores/useRecentlyViewedStore";
import { useProductsContext } from "@/contexts/ProductsContext";
import { cn } from "@/lib/utils";

interface RecentlyViewedBarProps {
  className?: string;
  maxVisible?: number;
}

export function RecentlyViewedBar({ className, maxVisible = 6 }: RecentlyViewedBarProps) {
  const navigate = useNavigate();
  const { 
    items, 
    itemCount, 
    removeFromRecentlyViewed,
    clearRecentlyViewed 
  } = useRecentlyViewedStore();
  const { getProductsByIds } = useProductsContext();

  const products = useMemo(
    () => getProductsByIds(items.map((i) => i.productId)).slice(0, maxVisible),
    [getProductsByIds, items, maxVisible]
  );

  if (itemCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "bg-card/80 backdrop-blur-md border border-border/50 rounded-xl p-3 shadow-md",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Vistos recentemente</span>
          </div>

          {/* Products */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none">
            {products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="relative flex-shrink-0 group"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(`/produto/${product.id}`)}
                      className={cn(
                        "w-10 h-10 rounded-lg overflow-hidden border-2 border-border/50",
                        "bg-muted cursor-pointer hover:border-primary/50 transition-all duration-200",
                        "hover:scale-110 hover:shadow-md"
                      )}
                    >
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(product.price)}
                    </p>
                  </TooltipContent>
                </Tooltip>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromRecentlyViewed(product.id);
                  }}
                  className={cn(
                    "absolute -top-1 -right-1 w-4 h-4 rounded-full",
                    "bg-muted-foreground/80 text-background",
                    "flex items-center justify-center",
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    "hover:bg-destructive"
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </motion.div>
            ))}

            {itemCount > maxVisible && (
              <button
                onClick={() => navigate("/favoritos")}
                className="w-10 h-10 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center flex-shrink-0 hover:border-primary/50 transition-colors"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  +{itemCount - maxVisible}
                </span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={clearRecentlyViewed}
                 aria-label="Excluir"><Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar histórico</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
