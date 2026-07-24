import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product-catalog';
import { useQuery } from '@tanstack/react-query';
import { productService } from '@/services/productService';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface RelatedProductsProps {
  currentProduct: Product;
  maxItems?: number;
}

// BUG-RELP-01 FIX (2026-06-21): Intl.NumberFormat dentro do componente → recriado por render.
const relatedPriceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const formatRelatedPrice = (price: number) => relatedPriceFormatter.format(price);

function ProductMiniCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card',
        'h-full cursor-pointer transition-all duration-300',
        'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
      )}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        <OptimizedImage
          src={getCdnUrl(product.images[0] || '/placeholder.svg', 'card')}
          urlOriginal={getProxiedImageUrl(product.images[0]) ?? null}
          alt={product.name}
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {product.newArrival && (
            <Badge className="bg-primary/90 px-1.5 py-0 text-[9px] text-primary-foreground">
              Novo
            </Badge>
          )}
          {product.isKit && (
            <Badge className="bg-warning/90 px-1.5 py-0 text-[9px] text-warning-foreground">
              Kit
            </Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {product.category?.name || 'Catálogo'}
        </p>
        <h4 className="line-clamp-2 flex-1 text-xs font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-sm">
          {product.name}
        </h4>

        <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm font-bold text-foreground sm:text-base">
              {formatRelatedPrice(product.price)}
            </span>
            <div className="flex -space-x-1">
              {product.colors.slice(0, 3).map((color, idx) => (
                <Tooltip key={`${color.name}-${idx}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="h-3 w-3 rounded-full border border-background ring-1 ring-border/30"
                      style={{ backgroundColor: color.hex }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{color.name}</TooltipContent>
                </Tooltip>
              ))}
              {product.colors.length > 3 && (
                <div className="flex h-3 w-3 items-center justify-center rounded-full border border-background bg-muted">
                  <span className="text-[6px] text-muted-foreground">
                    +{product.colors.length - 3}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-2 w-2" />
              Min. {product.minQuantity}
            </span>
            <span className="max-w-[60px] truncate">{product.supplier?.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RelatedProductsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[3/4] overflow-hidden rounded-xl border border-border/50">
            <Skeleton className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RelatedProducts({ currentProduct, maxItems = 4 }: RelatedProductsProps) {
  const navigate = useNavigate();

  const { data: relatedProducts, isLoading } = useQuery({
    queryKey: ['related-products', currentProduct.id, maxItems],
    queryFn: () => productService.fetchRelatedProducts(currentProduct, maxItems),
    staleTime: 10 * 60 * 1000,
    enabled: !!currentProduct.id,
  });

  if (isLoading) return <RelatedProductsSkeleton />;
  if (!relatedProducts || relatedProducts.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">
          Produtos Relacionados
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-primary"
          onClick={() => navigate(`/?category=${currentProduct.category?.id}`)}
        >
          <span className="hidden sm:inline">Ver mais</span>
          <ArrowRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {relatedProducts.map((product, index) => (
          <div
            key={product.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <ProductMiniCard product={product} onClick={() => navigate(`/produto/${product.id}`)} />
          </div>
        ))}
      </div>
    </section>
  );
}
