import { useRef, useCallback, useState, useEffect, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, m as motion } from 'framer-motion';
import { Loader2, ArrowUp } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { ProductListItem } from './ProductListItem';
import { ProductCardSkeleton } from '@/components/loading/ModernSkeletons';
import { InlineFilterBar } from '@/components/filters/StickyFilterBar';
import type { Product } from '@/hooks/products';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { useProductsColorsBatch } from '@/hooks/products/useProductsColorsBatch';

interface VirtualizedProductGridProps {
  products: Product[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  columns?: number;
  onProductClick?: (productId: string) => void;
  isFavorited?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: (productId: string) => boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  onShare?: (product: Product) => void;
  // Filter controls
  activeFiltersCount?: number;
  sortBy?: string;
  onSortChange?: (value: string) => void;
  onOpenFilters?: () => void;
  onClearFilters?: () => void;
  viewMode?: 'grid' | 'list' | 'table';
  onViewModeChange?: (mode: 'grid' | 'list' | 'table') => void;
  showFilterBar?: boolean;
  /** Filtros de cor ativos para mostrar imagem específica da cor no card */
  activeColorFilter?: ActiveColorFilter | null;
  /** Column selector React node to render in the filter bar */
  columnSelector?: React.ReactNode;
  /** External selection mode */
  selectionMode?: boolean;
  /** External selected IDs */
  selectedIds?: Set<string>;
  /** External toggle handler */
  onToggleSelect?: (id: string) => void;
  onStatusClick?: (type: string, value?: string | number) => void;
  /**
   * BUG-SCROLL-01 FIX: Chave que muda SOMENTE em filter/sort — NUNCA em load-more.
   * Quando muda, o grid rola ao topo. Quando `undefined` (padrão legado), o scroll
   * reset ocorre em toda mudança de referência do array (FiltersPage: backward-compat).
   */
  scrollResetKey?: string;
}

function VirtualizedProductGridInner({
  products,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  columns = 4,
  onProductClick,
  isFavorited,
  onToggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare = true,
  onShare,
  activeFiltersCount = 0,
  sortBy = 'name',
  onSortChange,
  onOpenFilters,
  onClearFilters,
  viewMode = 'grid',
  onViewModeChange,
  showFilterBar = false,
  activeColorFilter,
  columnSelector,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onStatusClick,
  scrollResetKey,
}: VirtualizedProductGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // In list mode, always 1 column; in grid mode use columns prop
  const effectiveColumns = viewMode === 'list' ? 1 : columns;

  // Column gap varies by density, row gap is always consistent
  const colGapPx = useMemo(() => {
    if (effectiveColumns >= 8) return 16;
    if (effectiveColumns >= 6) return 24;
    return 32;
  }, [effectiveColumns]);
  const rowGapPx = viewMode === 'list' ? 8 : 32;

  // Hidrata cores nos cards cujo fetch principal (lightweight) não trouxe `colors`.
  // Mesmo padrão usado no ProductGrid (Novidades/Reposição) — SSOT em useProductsColorsBatch.
  const idsNeedingColors = useMemo(
    () => products.filter((p) => !p.colors || p.colors.length === 0).map((p) => p.id),
    [products],
  );
  const { data: colorsByProduct } = useProductsColorsBatch(idsNeedingColors);
  const hydratedProducts = useMemo(() => {
    if (colorsByProduct.size === 0) return products;
    return products.map((p) => {
      if (p.colors && p.colors.length > 0) return p;
      const batch = colorsByProduct.get(p.id);
      if (!batch || batch.length === 0) return p;
      return {
        ...p,
        colors: batch.map((c) => ({ name: c.name, hex: c.hex || '', group: '' })),
      };
    });
  }, [products, colorsByProduct]);

  // Calculate rows based on columns
  const rowCount = Math.ceil(products.length / effectiveColumns);
  const estimatedRowHeight =
    viewMode === 'list'
      ? 88 // Altura fixa do ListItem (88px)
      : 520; // Altura média do Grid Card (pode variar ligeiramente por zoom)

  const virtualizer = useVirtualizer({
    count: hasMore ? rowCount + 1 : rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (hasMore && index === rowCount) return 120; // Espaço para loader/skeleton
      return estimatedRowHeight;
    },
    overscan: viewMode === 'list' ? 10 : 5,
    scrollMargin: 0,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll: load more when reaching the bottom
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;

    // Show scroll-to-top button after scrolling 300px
    setShowScrollTop(scrollTop > 300);

    // Load more when 500px from bottom
    if (!hasMore || loadingMore || isLoading) return;
    const scrollThreshold = 500;

    if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
      setLoadingMore(true);
      onLoadMore?.();
    }
  }, [hasMore, loadingMore, isLoading, onLoadMore]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // BUG-SCROLL-01 FIX: dois efeitos com responsabilidades distintas.
  //
  // PROBLEMA ANTERIOR: um único useEffect([products]) chamava scrollTo(0)
  // toda vez que displayCount subia via loadMore() — products = nova slice
  // = nova referência — causando snap-back inevitável com 7.143 produtos.
  //
  // SOLUÇÃO:
  //   1. setLoadingMore(false) → em toda mudança de products (inclusive load-more)
  //   2. scrollTo(0) → SOMENTE quando scrollResetKey muda (filter/sort/viewMode)
  //      scrollResetKey não muda em load-more → scroll preservado ✓
  //
  // Modo legado (scrollResetKey=undefined): FiltersPage e similares que não passam
  // a prop continuam com o comportamento anterior (scroll reset no products change).
  useEffect(() => {
    setLoadingMore(false);
  }, [products]);

  useEffect(() => {
    if (scrollResetKey === undefined) {
      // Modo legado: backward-compat para callers sem a prop.
      parentRef.current?.scrollTo({ top: 0 });
      return;
    }
    // scrollResetKey definido: rola ao topo somente em filter/sort/viewMode.
    parentRef.current?.scrollTo({ top: 0 });
  }, [scrollResetKey]);

  const scrollToTop = () => {
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="relative h-full">
        <div
          className="scrollbar-products h-full overflow-y-auto rounded-xl border border-border/40 bg-background shadow-sm"
          style={{ contain: 'strict' }}
        >
          {showFilterBar &&
            !isLoading &&
            onSortChange &&
            onOpenFilters &&
            onClearFilters &&
            onViewModeChange && (
              <div className="sticky top-0 z-20 mb-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-md">
                <InlineFilterBar
                  activeFiltersCount={activeFiltersCount}
                  totalProducts={0}
                  sortBy={sortBy}
                  onSortChange={onSortChange}
                  onOpenFilters={onOpenFilters}
                  onClearFilters={onClearFilters}
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                  columnSelector={columnSelector}
                />
              </div>
            )}

          <div className="p-4">
            <div
              className={cn(
                'grid gap-y-8',
                viewMode === 'list'
                  ? 'grid-cols-1'
                  : `grid-cols-2 sm:grid-cols-3 ${columns >= 4 ? 'lg:grid-cols-4' : ''} ${columns >= 5 ? 'xl:grid-cols-5' : ''} ${columns >= 6 ? '2xl:grid-cols-6' : ''}`,
              )}
              style={
                viewMode !== 'list'
                  ? {
                      columnGap: `${colGapPx}px`,
                    }
                  : undefined
              }
            >
              {Array.from({ length: 15 }).map((_, i) => (
                <ProductCardSkeleton
                  key={i}
                  variant={viewMode === 'list' ? 'compact' : 'default'}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div
        ref={parentRef}
        data-testid="virtualized-product-grid"
        className="scrollbar-products h-full overflow-y-auto rounded-xl border border-border/40 bg-background shadow-sm"
        style={{ contain: 'strict' }}
      >
        {/* Barra de filtros sticky DENTRO do container de scroll */}
        {showFilterBar &&
          !isLoading &&
          onSortChange &&
          onOpenFilters &&
          onClearFilters &&
          onViewModeChange && (
            <div className="sticky top-0 z-20 mb-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur-md">
              <InlineFilterBar
                activeFiltersCount={activeFiltersCount}
                totalProducts={products.length}
                sortBy={sortBy}
                onSortChange={onSortChange}
                onOpenFilters={onOpenFilters}
                onClearFilters={onClearFilters}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                columnSelector={columnSelector}
              />
            </div>
          )}

        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            padding: '1rem',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index === rowCount && hasMore;

            if (isLoaderRow) {
              return (
                <div
                  key="loader"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="px-4"
                >
                  <div
                    className={cn(
                      'grid gap-y-8',
                      viewMode === 'list'
                        ? 'grid-cols-1'
                        : `grid-cols-2 sm:grid-cols-3 ${columns >= 4 ? 'lg:grid-cols-4' : ''} ${columns >= 5 ? 'xl:grid-cols-5' : ''} ${columns >= 6 ? '2xl:grid-cols-6' : ''}`,
                    )}
                    style={
                      viewMode !== 'list'
                        ? {
                            columnGap: `${colGapPx}px`,
                          }
                        : undefined
                    }
                  >
                    {Array.from({ length: effectiveColumns }).map((_, i) => (
                      <ProductCardSkeleton
                        key={i}
                        variant={viewMode === 'list' ? 'compact' : 'default'}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Carregando mais...</span>
                  </div>
                </div>
              );
            }

            // Get products for this row
            const startIndex = virtualRow.index * effectiveColumns;
            const rowProducts = hydratedProducts.slice(startIndex, startIndex + effectiveColumns);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  ...(viewMode === 'list'
                    ? {
                        display: 'flex',
                        flexDirection: 'column' as const,
                        paddingLeft: '0.5rem',
                        paddingRight: '1.5rem',
                        paddingBottom: `${rowGapPx}px`,
                      }
                    : {
                        display: 'grid',
                        gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
                        columnGap: `${colGapPx}px`,
                        paddingLeft: '0.5rem',
                        paddingRight: '1.5rem',
                        paddingBottom: `${rowGapPx}px`,
                        isolation: 'isolate',
                      }),
                }}
              >
                {rowProducts.map((product) =>
                  viewMode === 'list' ? (
                    <ProductListItem
                      key={product.id}
                      product={product}
                      onClick={() => onProductClick?.(product.id)}
                      isFavorited={isFavorited?.(product.id)}
                      onToggleFavorite={onToggleFavorite}
                      isInCompare={isInCompare?.(product.id)}
                      onToggleCompare={onToggleCompare}
                      canAddToCompare={canAddToCompare}
                      activeColorFilter={activeColorFilter}
                      onStatusClick={onStatusClick}
                      priority={virtualRow.index === 0}
                    />
                  ) : (
                    <div
                      key={product.id}
                      className={cn(
                        'relative',
                        selectionMode &&
                          selectedIds?.has(product.id) &&
                          'rounded-2xl shadow-md ring-2 ring-primary/50',
                      )}
                    >
                      {selectionMode && (
                        <button
                          className={cn(
                            'absolute left-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200',
                            selectedIds?.has(product.id)
                              ? 'scale-100 border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-card/80 backdrop-blur-sm hover:border-primary/60',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect?.(product.id);
                          }}
                        >
                          {selectedIds?.has(product.id) && (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                              <path
                                d="M11.5 3.5L5.5 10L2.5 7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                      <ProductCard
                        product={product}
                        onClick={() => onProductClick?.(product.id)}
                        isFavorited={isFavorited?.(product.id)}
                        onToggleFavorite={onToggleFavorite}
                        isInCompare={isInCompare?.(product.id)}
                        onToggleCompare={onToggleCompare}
                        canAddToCompare={canAddToCompare}
                        onShare={onShare}
                        activeColorFilter={activeColorFilter}
                        onStatusClick={onStatusClick}
                      />
                    </div>
                  ),
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll to top button - posicionado dentro do container */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-4 right-4 z-30 rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
            onClick={scrollToTop}
            title="Voltar ao topo"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export const VirtualizedProductGrid = memo(VirtualizedProductGridInner);
VirtualizedProductGrid.displayName = 'VirtualizedProductGrid';
