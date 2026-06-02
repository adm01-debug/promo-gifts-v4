import { memo, useMemo, useCallback, type RefObject, lazy, Suspense } from 'react';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// FIX: lazy-load ALL catalog view components to break circular chunk dependency.
// The cycle was: index chunk → CatalogContent → ProductGrid/ProductCard chunk → index chunk.
// ProductCard imports utilities (cn, Tooltip, Skeleton, query config) from the index chunk,
// while the index chunk imports CatalogContent which statically imported ProductGrid.
// Making all three views lazy forces Vite to create separate async chunks,
// completely breaking the circular module evaluation order.
const LazyProductGrid = lazy(() =>
  import('@/components/products/ProductGrid').then(m => ({ default: m.ProductGrid }))
);
const LazyProductList = lazy(() =>
  import('@/components/products/ProductList').then(m => ({ default: m.ProductList }))
);
const LazyProductTableView = lazy(() =>
  import('@/components/products/ProductTableView').then(m => ({ default: m.ProductTableView }))
);
import {
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProductTableSkeleton,
} from '@/components/loading/ModernSkeletons';
import { EmptyState } from '@/components/common/EmptyState';
import { CatalogBulkModals } from './CatalogBulkModals';
import { useCatalogSelection } from './useCatalogSelection';
import type { Product } from '@/types/product-catalog';
import type { ViewMode } from '@/hooks/products/useCatalogState';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { SparklineSalesProvider } from '@/hooks/intelligence/useSparklineSales';
import { ProductLeafCategoryProvider } from '@/hooks/products/useProductLeafCategories';
import { ScrollToTopButton } from '@/components/common/ScrollToTopButton';

interface CatalogContentProps {
  viewMode: ViewMode;
  shouldShowCatalogSkeleton: boolean;
  shouldShowEmptyState: boolean;
  hasActiveCatalogConstraints: boolean;
  paginatedProducts: Product[];
  filteredProducts: Product[];
  gridColumns: ColumnCount;
  hasMoreProducts: boolean;
  isLoadingMore: boolean;
  totalEstimate: number | null;
  loadMoreRef: RefObject<HTMLDivElement>;
  itemsPerPage: number;
  navigate: (path: string) => void;
  handleViewProduct: (p: Product) => void;
  handleShareProduct: (p: Product) => void;
  handleFavoriteProduct: (p: Product) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isInCompare: (id: string) => boolean;
  onToggleCompare: (id: string) => { added: boolean; isFull: boolean };
  canAddToCompare: boolean;
  onLoadMore?: () => void;
  onResetFilters?: () => void;
  selectionMode?: boolean;
  onSelectedCountChange?: (count: number) => void;
  activeColorFilter?: ActiveColorFilter | null;
  activeProductId?: string | null;
  setActiveProductId?: (id: string | null) => void;
  hideCategoryBadges?: boolean;
}

export const CatalogContent = memo(function CatalogContent({
  viewMode,
  shouldShowCatalogSkeleton,
  shouldShowEmptyState,
  hasActiveCatalogConstraints,
  paginatedProducts,
  filteredProducts,
  gridColumns,
  hasMoreProducts,
  isLoadingMore,
  totalEstimate,
  loadMoreRef,
  itemsPerPage: _itemsPerPage,
  navigate,
  handleViewProduct,
  handleShareProduct,
  handleFavoriteProduct,
  isFavorite,
  toggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare,
  onLoadMore: _onLoadMore,
  onResetFilters,
  selectionMode,
  onSelectedCountChange,
  activeColorFilter,
  activeProductId: _activeProductId,
  setActiveProductId: _setActiveProductId,
  hideCategoryBadges = false,
}: CatalogContentProps) {
  const selection = useCatalogSelection(paginatedProducts, selectionMode, onSelectedCountChange);
  const { selectedIds, toggleSelect: onToggleSelect } = selection;

  const handleProductClick = useCallback((pid: string) => navigate(`/produto/${pid}`), [navigate]);

  const productIds = useMemo(() => paginatedProducts.map((p) => p.id), [paginatedProducts]);

  if (shouldShowCatalogSkeleton) {
    if (viewMode === 'list') {
      return (
        <div className="space-y-2" data-testid="catalog-list-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="duration-300 animate-in fade-in slide-in-from-left-2"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <ProductCardSkeleton variant="compact" selectionMode={selectionMode} />
            </div>
          ))}
        </div>
      );
    }
    if (viewMode === 'table') {
      return (
        <div data-testid="catalog-table-skeleton">
          <ProductTableSkeleton rows={10} selectionMode={selectionMode} />
        </div>
      );
    }
    return (
      <div data-testid="catalog-grid-skeleton">
        <ProductGridSkeleton
          count={12}
          columns={gridColumns}
          variant="default"
          hideCategoryBadges={hideCategoryBadges}
          selectionMode={selectionMode}
        />
      </div>
    );
  }

  if (shouldShowEmptyState) {
    return (
      <EmptyState
        variant="products"
        title="Nenhum produto encontrado"
        description={
          hasActiveCatalogConstraints
            ? 'Tente ajustar seus filtros para ver mais resultados.'
            : 'Explore nosso catálogo completo para encontrar o que procura.'
        }
        action={
          onResetFilters
            ? {
                label: 'Limpar todos os filtros',
                onClick: onResetFilters,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div
      className={cn(
        'relative space-y-8 pb-12 duration-500 animate-in fade-in',
        isLoadingMore && 'opacity-80 transition-opacity',
      )}
    >
      <SparklineSalesProvider productIds={productIds}>
        <ProductLeafCategoryProvider productIds={productIds}>
          {viewMode === 'grid' && (
            <Suspense fallback={
              <ProductGridSkeleton
                count={12}
                columns={gridColumns}
                variant="default"
                hideCategoryBadges={hideCategoryBadges}
                selectionMode={selectionMode}
              />
            }>
              <LazyProductGrid
                products={paginatedProducts}
                isLoading={isLoadingMore}
                onProductClick={handleProductClick}
                onViewProduct={handleViewProduct}
                onShareProduct={handleShareProduct}
                onFavoriteProduct={handleFavoriteProduct}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={onToggleCompare}
                canAddToCompare={canAddToCompare}
                columns={gridColumns}
                activeColorFilter={activeColorFilter}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </Suspense>
          )}

          {viewMode === 'list' && (
            <Suspense fallback={
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ProductCardSkeleton key={i} variant="compact" selectionMode={selectionMode} />
                ))}
              </div>
            }>
              <LazyProductList
                products={paginatedProducts}
                isLoading={isLoadingMore}
                onProductClick={handleProductClick}
                onViewProduct={handleViewProduct}
                onShareProduct={handleShareProduct}
                onFavoriteProduct={handleFavoriteProduct}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={onToggleCompare}
                canAddToCompare={canAddToCompare}
                activeColorFilter={activeColorFilter}
                selectionMode={selectionMode}
                externalSelectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </Suspense>
          )}

          {viewMode === 'table' && (
            <Suspense fallback={<ProductTableSkeleton rows={10} selectionMode={selectionMode} />}>
              <LazyProductTableView
                products={paginatedProducts}
                isLoading={isLoadingMore}
                onProductClick={handleProductClick}
                onShareProduct={handleShareProduct}
                isFavorite={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={onToggleCompare}
                canAddToCompare={canAddToCompare}
                activeColorFilter={activeColorFilter}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </Suspense>
          )}
        </ProductLeafCategoryProvider>
      </SparklineSalesProvider>

      {hasMoreProducts && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                <Skeleton
                  className="h-2 w-2 animate-bounce rounded-full"
                  style={{ animationDelay: '0ms' }}
                />
                <Skeleton
                  className="h-2 w-2 animate-bounce rounded-full"
                  style={{ animationDelay: '150ms' }}
                />
                <Skeleton
                  className="h-2 w-2 animate-bounce rounded-full"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
              <p className="animate-pulse text-xs font-medium text-muted-foreground">
                Carregando mais produtos...
              </p>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Exibindo{' '}
              {Math.min(paginatedProducts.length, totalEstimate || filteredProducts.length)} de{' '}
              {totalEstimate || filteredProducts.length} produtos
            </div>
          )}
        </div>
      )}

      <CatalogBulkModals
        sel={selection}
        selectionMode={selectionMode}
        totalCount={totalEstimate || filteredProducts.length}
      />

      <ScrollToTopButton className="fixed bottom-6 right-6 z-[60]" />
    </div>
  );
});
