import { useRef, useState, useCallback, forwardRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Layers, Loader2, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useExternalCategoriesQuery } from "@/hooks/products/useExternalCategoriesQuery";
import { useSimilarProducts, type SimilarProductItem } from "@/hooks/products/useSimilarProducts";
import type { Product } from "@/types/product-catalog";

interface SimilarProductsProps {
  currentProduct: Product;
  maxItems?: number;
}

const SimilarProductCard = forwardRef<
  HTMLDivElement,
  {
    item: SimilarProductItem;
    onClick: () => void;
    index: number;
    isLowestPrice?: boolean;
  }
>(({ item, onClick, index, isLowestPrice }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "group relative min-w-0 shrink-0 snap-start",
        "rounded-xl bg-card border border-border/50 overflow-hidden",
        "transition-all duration-300 cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1",
        "animate-fade-in"
      )}
      style={{
        animationDelay: `${index * 60}ms`,
        flex: "0 0 calc((100% - 5.25rem) / 8)",
        maxWidth: "calc((100% - 5.25rem) / 8)",
      }}
      onClick={onClick}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        {isLowestPrice && (
          <div className="absolute top-1.5 right-1.5">
            <Badge className="text-[9px] px-1.5 py-0.5 bg-primary/90 text-primary-foreground backdrop-blur-sm border-none shadow-sm gap-0.5">
              <TrendingDown className="h-2.5 w-2.5" />
              Menor preço
            </Badge>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <Badge
            variant="secondary"
            className="text-[9px] px-1.5 py-0 bg-background/80 backdrop-blur-sm border-none shadow-sm"
          >
            {item.supplier_name}
          </Badge>
        </div>
      </div>

      <div className="p-2.5 xl:p-3.5 space-y-1 xl:space-y-1.5 min-w-0">
        <p className="text-[10px] xl:text-xs text-muted-foreground truncate">{item.category_name}</p>
        <h4 className="font-medium text-xs xl:text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors min-h-[2rem]">
          {item.name}
        </h4>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="font-display font-bold text-sm xl:text-base text-foreground truncate">
            R$ {item.price.toFixed(2).replace('.', ',')}
          </span>
          {item.colors_count && item.colors_count > 0 && (
            <span className="text-[10px] xl:text-xs text-muted-foreground shrink-0">
              {item.colors_count} cores
            </span>
          )}
        </div>
        <p className="text-[10px] xl:text-xs text-muted-foreground font-mono truncate">
          REF: {item.sku}
        </p>
      </div>
    </div>
  );
});

SimilarProductCard.displayName = "SimilarProductCard";

export function SimilarProducts({
  currentProduct,
  maxItems = 12,
}: SimilarProductsProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const { data: dbItems = [], isLoading } = useSimilarProducts(currentProduct);
  const { data: categories = [] } = useExternalCategoriesQuery();

  // Enrich items with category names and find lowest price
  const { similarItems, lowestPriceId } = useMemo(() => {
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    const enriched = dbItems.map(item => ({
      ...item,
      category_name: catMap.get(item.category_id || '') || item.category_name || '',
    }));
    let minPrice = Infinity;
    let minId = '';
    for (const item of enriched) {
      if (item.price > 0 && item.price < minPrice) {
        minPrice = item.price;
        minId = item.id;
      }
    }
    return { similarItems: enriched, lowestPriceId: minId };
  }, [dbItems, categories]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(updateScrollButtons, 400);
  }, [updateScrollButtons]);

  if (!isLoading && similarItems.length === 0) return null;

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
            <Layers className="h-4.5 w-4.5 text-foreground" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">Produtos Semelhantes</h2>
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando produtos semelhantes...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
            <Layers className="h-4.5 w-4.5 text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground truncate">
              Produtos Semelhantes
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {similarItems.length} produtos com aparência similar de diferentes fornecedores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <Button
            variant="outline"
            size="icon" aria-label="Voltar"
            className="h-10 w-10 rounded-xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/20 hover:border-primary/60 transition-all duration-200 shadow-md"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-5 w-5 text-primary" />
          </Button>
          <Button
            variant="outline"
            size="icon" aria-label="Avançar"
            className="h-10 w-10 rounded-xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/20 hover:border-primary/60 transition-all duration-200 shadow-md"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className={cn(
            "flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory",
            "pb-2 -mb-2"
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {similarItems.map((item, index) => (
            <SimilarProductCard
              key={item.id}
              item={item}
              index={index}
              isLowestPrice={item.id === lowestPriceId && similarItems.length > 1}
              onClick={() => navigate(`/produto/${item.id}`)}
            />
          ))}
        </div>

        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        )}
      </div>
    </section>
  );
}
