import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRecentlyViewedStore } from '@/stores/useRecentlyViewedStore';
import { useProductsContext } from '@/contexts/ProductsContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';

interface RecentlyViewedPopoverProps {
  maxVisible?: number;
}

export function RecentlyViewedPopover({ maxVisible = 10 }: RecentlyViewedPopoverProps) {
  const navigate = useNavigate();
  const { items, itemCount, removeFromRecentlyViewed, clearRecentlyViewed } =
    useRecentlyViewedStore();
  const { getProductsByIds } = useProductsContext();

  const products = useMemo(
    () => getProductsByIds(items.map((i) => i.productId)).slice(0, maxVisible),
    [getProductsByIds, items, maxVisible],
  );

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Vistos recentemente"
                className={cn(
                  'relative h-10 w-10 rounded-full border-border/50 transition-colors',
                  itemCount > 0 ? 'hover:border-primary/50' : 'opacity-60 hover:opacity-100',
                )}
              >
                <Clock className="h-4 w-4" />
                {itemCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground shadow-sm"
                  >
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>Vistos recentemente{itemCount > 0 ? ` (${itemCount})` : ''}</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-80 p-3" sideOffset={8}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Vistos recentemente</span>
              {itemCount > 0 && (
                <span className="text-xs text-muted-foreground">({itemCount})</span>
              )}
            </div>
            {itemCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={clearRecentlyViewed}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Limpar histórico</TooltipContent>
              </Tooltip>
            )}
          </div>

          {itemCount === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhum produto visualizado ainda
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {products.map((product) => (
                <div key={product.id} className="group relative">
                  <button
                    onClick={() => navigate(`/produto/${product.id}`)}
                    className={cn(
                      'aspect-square w-full overflow-hidden rounded-lg border-2 border-border/50',
                      'cursor-pointer bg-muted transition-all duration-200 hover:border-primary/50',
                      'hover:scale-105 hover:shadow-md',
                    )}
                  >
                    <OptimizedImage
                      src={getCdnUrl(product.images?.[0], 'thumbnail')}
                      alt={product.name}
                      className="object-cover"
                      containerClassName="h-full w-full"
                    />
                  </button>
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
                  <p className="mt-1 truncate text-center text-[9px] leading-tight text-muted-foreground">
                    {product.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
