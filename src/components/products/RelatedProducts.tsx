import { useNavigate } from "react-router-dom";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product-catalog";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/productService";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getCdnUrl } from "@/utils/image-utils";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface RelatedProductsProps {
  currentProduct: Product;
  maxItems?: number;
}

function ProductMiniCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const formatPrice = (price: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl bg-card border border-border/50 overflow-hidden",
        "transition-all duration-300 cursor-pointer h-full",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-muted/30">
        <OptimizedImage
          src={getCdnUrl(product.images[0] || "/placeholder.svg", "card")}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {product.newArrival && (
            <Badge className="bg-primary/90 text-primary-foreground text-[9px] px-1.5 py-0">
              Novo
            </Badge>
          )}
          {product.isKit && (
            <Badge className="bg-warning/90 text-warning-foreground text-[9px] px-1.5 py-0">
              Kit
            </Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-medium">
          {product.category?.name || 'Catálogo'}
        </p>
        <h4 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors flex-1">
          {product.name}
        </h4>
        
        <div className="pt-2 border-t border-border/50 flex flex-col gap-1">
          <div className="flex items-center justify-between">
             <span className="font-display font-bold text-sm sm:text-base text-foreground">
              {formatPrice(product.price)}
            </span>
            <div className="flex -space-x-1">
              {product.colors.slice(0, 3).map((color, idx) => (
                <div
                  key={idx}
                  className="w-3 h-3 rounded-full border border-background ring-1 ring-border/30"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
              {product.colors.length > 3 && (
                <div className="w-3 h-3 rounded-full bg-muted border border-background flex items-center justify-center">
                  <span className="text-[6px] text-muted-foreground">+{product.colors.length - 3}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium">
             <span className="flex items-center gap-1">
               <Package className="h-2 w-2" />
               Min. {product.minQuantity}
             </span>
             <span className="truncate max-w-[60px]">{product.supplier?.name}</span>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[3/4] rounded-xl overflow-hidden border border-border/50">
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
        <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
          Produtos Relacionados
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary h-8"
          onClick={() => navigate(`/?category=${currentProduct.category?.id}`)}
        >
          <span className="hidden sm:inline">Ver mais</span>
          <ArrowRight className="h-4 w-4 sm:ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {relatedProducts.map((product, index) => (
          <div
            key={product.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <ProductMiniCard
              product={product}
              onClick={() => navigate(`/produto/${product.id}`)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
