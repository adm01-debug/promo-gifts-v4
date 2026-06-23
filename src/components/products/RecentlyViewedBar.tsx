import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import { useProductsContext } from '@/contexts/ProductsContext';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getProxiedImageUrl } from '@/utils/imageProxy';
import { getCdnUrl } from '@/utils/image-utils';

// BUG-RVB-02 FIX (2026-06-21): Intl.NumberFormat construída dentro do map por produto/render.
const priceFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface RecentlyViewedBarProps {
  className?: string;
  maxVisible?: number;
}

export function RecentlyViewedBar({ className, maxVisible = 6 }: RecentlyViewedBarProps) {
  const navigate = useNavigate();
  const { items, itemCount, removeFromRecentlyViewed, clearRecentlyViewed } =
    useRecentlyViewedStore();
  const { getProductsByIds } = useProductsContext();

  const products = useMemo(
    () => getProductsByIds(items.map((i) => i.productId)).slice(0, maxVisible),
    [getProductsByIds, items, maxVisible],
  );

  if (itemCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-xl border border-border/50 bg-card/80 p-3 shadow-md backdrop-blur-md',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Vistos recentemente</span>
          </div>

          {/* Products */}
          <div className="scrollbar-none flex flex-1 items-center gap-2 overflow-x-auto">
            {products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="group relative flex-shrink-0"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(`/produto/${product.id}`)}
                      className={cn(
                        'h-10 w-10 overflow-hidden rounded-lg border-2 border-border/50',
                        'cursor-pointer bg-muted transition-all duration-200 hover:border-primary/50',
                        'hover:scale-110 hover:shadow-md',
                      )}
                    >
                      <OptimizedImage
                        src={getCdnUrl(product.images?.[0] ?? '', 'thumbnail')}
                        urlOriginal={getProxiedImageUrl(product.images?.[0] ?? '') ?? null}
                        alt={product.name}
                        className="object-cover"
                        containerClassName="h-full w-full"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {priceFormatter.format(product.price)}
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
                    'absolute -right-1 -top-1 h-4 w-4 rounded-full',
                    'bg-muted-foreground/80 text-background',
                    'flex items-center justify-center',
                    'opacity-0 transition-opacity group-hover:opacity-100',
                    'hover:bg-destructive',
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </motion.div>
            ))}

            {itemCount > maxVisible && (
              <button
                onClick={() => navigate('/favoritos')}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border/50 transition-colors hover:border-primary/50"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  +{itemCount - maxVisible}
                </span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={clearRecentlyViewed}
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
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
