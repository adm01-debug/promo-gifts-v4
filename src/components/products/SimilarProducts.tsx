import { useRef, useState, useCallback, forwardRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Layers, Loader2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useExternalCategoriesQuery } from '@/hooks/products/useExternalCategoriesQuery';
import { useSimilarProducts, type SimilarProductItem } from '@/hooks/products/useSimilarProducts';
import type { Product } from '@/types/product-catalog';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

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
        'group relative min-w-0 shrink-0 snap-start',
        'overflow-hidden rounded-xl border border-border/50 bg-card',
        'cursor-pointer transition-all duration-300',
        'hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        'animate-fade-in',
      )}
      style={{
        animationDelay: `${index * 60}ms`,
        flex: '0 0 calc((100% - 5.25rem) / 8)',
        maxWidth: 'calc((100% - 5.25rem) / 8)',
      }}
      onClick={onClick}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <OptimizedImage
          src={getCdnUrl(item.image_url, 'card')}
          alt={item.name}
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          containerClassName="h-full w-full"
        />
        {isLowestPrice && (
          <div className="absolute right-1.5 top-1.5">
            <Badge className="gap-0.5 border-none bg-primary/90 px-1.5 py-0.5 text-[9px] text-primary-foreground shadow-sm backdrop-blur-sm">
              <TrendingDown className="h-2.5 w-2.5" />
              Menor preço
            </Badge>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5">
          <Badge
            variant="secondary"
            className="border-none bg-background/80 px-1.5 py-0 text-[9px] shadow-sm backdrop-blur-sm"
          >
            {item.supplier_name}
          </Badge>
        </div>
      </div>

      <div className="min-w-0 space-y-1 p-2.5 xl:space-y-1.5 xl:p-3.5">
        <p className="truncate text-[10px] text-muted-foreground xl:text-xs">
          {item.category_name}
        </p>
        <h4 className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-tight text-foreground transition-colors group-hover:text-primary xl:text-sm">
          {item.name}
        </h4>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="truncate font-display text-sm font-bold text-foreground xl:text-base">
            R$ {item.price?.toFixed(2).replace('.', ',') ?? '—'}
          </span>
          {item.colors_count && item.colors_count > 0 && (
            <span className="shrink-0 text-[10px] text-muted-foreground xl:text-xs">
              {item.colors_count} cores
            </span>
          )}
        </div>
        <p className="truncate font-mono text-[10px] text-muted-foreground xl:text-xs">
          REF: {item.sku}
        </p>
      </div>
    </div>
  );
});

SimilarProductCard.displayName = 'SimilarProductCard';

export function SimilarProducts({
  currentProduct,
  maxItems: _maxItems = 12,
}: SimilarProductsProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const { data: dbItems = [], isLoading } = useSimilarProducts(currentProduct);
  const { data: categories = [] } = useExternalCategoriesQuery();

  // Enrich items with category names and find lowest price
  const { similarItems, lowestPriceId } = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const enriched = dbItems.map((item) => ({
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

  const scroll = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const scrollAmount = el.clientWidth;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(updateScrollButtons, 400);
    },
    [updateScrollButtons],
  );

  if (!isLoading && similarItems.length === 0) return null;

  if (isLoading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/50">
            <Layers className="h-4.5 w-4.5 text-foreground" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">Produtos Semelhantes</h2>
        </div>
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando produtos semelhantes...</span>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/50">
            <Layers className="h-4.5 w-4.5 text-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-foreground">
              Produtos Semelhantes
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {similarItems.length} produtos com aparência similar de diferentes fornecedores
            </p>
          </div>
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Voltar"
            className="h-10 w-10 rounded-xl border-2 border-primary/40 bg-primary/10 shadow-md transition-all duration-200 hover:border-primary/60 hover:bg-primary/20"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-5 w-5 text-primary" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Avançar"
            className="h-10 w-10 rounded-xl border-2 border-primary/40 bg-primary/10 shadow-md transition-all duration-200 hover:border-primary/60 hover:bg-primary/20"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-5 w-5 text-primary" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden">
        {canScrollLeft && (
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          className={cn(
            'scrollbar-hide flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden',
            '-mb-2 pb-2',
          )}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        )}
      </div>
    </section>
  );
}
