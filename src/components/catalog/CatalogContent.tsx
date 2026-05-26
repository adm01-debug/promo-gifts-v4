import { memo, type RefObject } from 'react';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { Skeleton } from '@/components/ui/skeleton';

import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductList } from '@/components/products/ProductList';
import { ProductTableView } from '@/components/products/ProductTableView';
import {
  ProductCardSkeleton,
  ProductListItemSkeleton,
  ProductTableSkeleton,
} from '@/components/loading/ModernSkeletons';
import { EmptyState } from '@/components/common/EmptyState';
import { CatalogBulkModals } from './CatalogBulkModals';
import { useCatalogSelection } from './useCatalogSelection';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/product-catalog';
import type { ViewMode } from '@/hooks/products/useCatalogState';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { SparklineSalesProvider } from '@/hooks/intelligence/useSparklineSales';
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

  if (shouldShowCatalogSkeleton) {
    if (viewMode === 'list') {
      return (
        <div className="space-y-2">
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
      return <ProductTableSkeleton rows={10} selectionMode={selectionMode} />;
    }
    return (
      <ProductGridSkeleton
        count={12}
        columns={gridColumns}
        variant="default"
        hideCategoryBadges={hideCategoryBadges}
        selectionMode={selectionMode}
      />
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
    <div className="relative space-y-8 pb-12 duration-500 animate-in fade-in">
      <SparklineSalesProvider productIds={paginatedProducts.map((p) => p.id)}>
        {viewMode === 'grid' && (
          <ProductGrid
            products={paginatedProducts}
            isLoading={isLoadingMore}
            onProductClick={(pid) => navigate(`/produto/${pid}`)}
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
        )}

        {viewMode === 'list' && (
          <ProductList
            products={paginatedProducts}
            isLoading={isLoadingMore}
            onProductClick={(pid) => navigate(`/produto/${pid}`)}
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
        )}

        {viewMode === 'table' && (
          <ProductTableView
            products={paginatedProducts}
            isLoading={isLoadingMore}
            onProductClick={(pid) => navigate(`/produto/${pid}`)}
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
        )}
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

      <ScrollToTopButton className="fixed bottom-6 right-6 z-50" />
    </div>
  );
});
