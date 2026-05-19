import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/products";

interface RelatedProductsProps {
  currentProduct: Product;
  allProducts: Product[];
  maxItems?: number;
}

function ProductMiniCard({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl bg-card border border-border/50 overflow-hidden",
        "transition-all duration-300 cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
        {product.newArrival && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
            Novo
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-xs text-muted-foreground truncate">{product.category.name}</p>
        <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {product.name}
        </h4>
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-foreground">
            R$ {product.price.toFixed(2).replace('.', ',')}
          </span>
          <div className="flex gap-0.5">
            {product.colors.slice(0, 3).map((color, idx) => (
              <div
                key={idx}
                className="w-3 h-3 rounded-full border border-background"
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RelatedProducts({ currentProduct, allProducts, maxItems = 4 }: RelatedProductsProps) {
  const navigate = useNavigate();

  const relatedProducts = useMemo(() => {
    // Find products in the same category, excluding current product
    const sameCategory = allProducts.filter(
      p => p.id !== currentProduct.id && p.category.id === currentProduct.category.id
    );

    // If not enough in same category, add products with similar materials
    let related = [...sameCategory];
    
    if (related.length < maxItems) {
      const currentMaterials = Array.isArray(currentProduct.materials) ? currentProduct.materials : [];
      const sameMaterial = allProducts.filter(
        p => p.id !== currentProduct.id && 
             !sameCategory.includes(p) &&
             (Array.isArray(p.materials) ? p.materials : []).some(m => currentMaterials.includes(m))
      );
      related = [...related, ...sameMaterial];
    }

    // If still not enough, add products with similar colors
    if (related.length < maxItems) {
      const currentColorGroups = currentProduct.colors.map(c => c.group);
      const sameColors = allProducts.filter(
        p => p.id !== currentProduct.id && 
             !related.includes(p) &&
             p.colors.some(c => currentColorGroups.includes(c.group))
      );
      related = [...related, ...sameColors];
    }

    return related.slice(0, maxItems);
  }, [currentProduct, allProducts, maxItems]);

  if (relatedProducts.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">
          Produtos Relacionados
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary"
          onClick={() => navigate(`/?category=${currentProduct.category.id}`)}
        >
          Ver mais
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

interface RecommendedProductsProps {
  currentProduct: Product;
  allProducts: Product[];
  maxItems?: number;
}

export function RecommendedProducts({ currentProduct, allProducts, maxItems = 4 }: RecommendedProductsProps) {
  const navigate = useNavigate();

  const recommendedProducts = useMemo(() => {
    // Find products with similar tags
    const currentTags = [
      ...currentProduct.tags.publicoAlvo,
      ...currentProduct.tags.datasComemorativas,
      ...currentProduct.tags.nicho
    ];

    const scored = allProducts
      .filter(p => p.id !== currentProduct.id)
      .map(p => {
        const productTags = [
          ...p.tags.publicoAlvo,
          ...p.tags.datasComemorativas,
          ...p.tags.nicho
        ];
        
        let score = 0;
        
        // Tag matching
        score += productTags.filter(t => currentTags.includes(t)).length * 2;
        
        // Same supplier bonus
        if (p.supplier.id === currentProduct.supplier.id) score += 1;
        
        // Featured bonus
        if (p.featured) score += 1;
        
        // Similar price range bonus
        const priceDiff = Math.abs(p.price - currentProduct.price);
        if (priceDiff < currentProduct.price * 0.3) score += 1;

        return { product: p, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxItems)
      .map(item => item.product);

    return scored;
  }, [currentProduct, allProducts, maxItems]);

  if (recommendedProducts.length === 0) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg shadow-primary/25">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Recomendados para Você
          </h2>
          <p className="text-sm text-muted-foreground">
            Baseado no produto que você está vendo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {recommendedProducts.map((product, index) => (
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