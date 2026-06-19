import { memo, useMemo, useCallback, type RefObject } from 'react';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { cn } from '@/lib/utils';

import { ProductTableView } from '@/components/products/ProductTableView';
import { VirtualizedProductGrid } from '@/components/products/VirtualizedProductGrid';
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
  // Novas props para controle de filtro e sort vindos do catalog state
  sortBy?: string;
  onSortChange?: (v: string) => void;
  onOpenFilters?: () => void;
  activeFiltersCount?: number;
  onViewModeChange?: (mode: ViewMode) => void;
  /** BUG-SCROLL-01 FIX: chave de reset de scroll — ver useCatalogState e VirtualizedProductGrid */
  scrollResetKey?: string;
}

export const CatalogContent = memo(
  ({
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
    handleViewProduct: _handleViewProduct,
    handleShareProduct,
    handleFavoriteProduct: _handleFavoriteProduct,
    isFavorite,
    toggleFavorite,
    isInCompare,
    onToggleCompare,
    canAddToCompare,
    onLoadMore,
    onResetFilters,
    selectionMode,
    onSelectedCountChange,
    activeColorFilter,
    activeProductId: _activeProductId,
    setActiveProductId: _setActiveProductId,
    hideCategoryBadges = false,
    sortBy = 'name',
    onSortChange,
    onOpenFilters,
    activeFiltersCount = 0,
    onViewModeChange,
    scrollResetKey,
  }: CatalogContentProps) => {
    const selection = useCatalogSelection(paginatedProducts, selectionMode, onSelectedCountChange);
    const { selectedIds, toggleSelect: onToggleSelect } = selection;

    const handleProductClick = useCallback(
      (pid: string) => navigate(`/produto/${pid}`),
      [navigate],
    );

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

    // Se estivermos em um destes modos, usamos o grid virtualizado para melhor performance
    if (viewMode === 'grid' || viewMode === 'list') {
      return (
        <SparklineSalesProvider productIds={productIds}>
          <ProductLeafCategoryProvider productIds={productIds}>
            <div className="h-[calc(100vh-var(--header-h,56px)-var(--breadcrumb-h,0px)-200px)] min-h-[500px] w-full">
              <VirtualizedProductGrid
                products={paginatedProducts}
                isLoading={isLoadingMore}
                hasMore={hasMoreProducts}
                onLoadMore={onLoadMore}
                columns={gridColumns}
                viewMode={viewMode}
                onProductClick={handleProductClick}
                isFavorited={isFavorite}
                onToggleFavorite={toggleFavorite}
                isInCompare={isInCompare}
                onToggleCompare={onToggleCompare}
                canAddToCompare={canAddToCompare}
                onShare={handleShareProduct}
                activeColorFilter={activeColorFilter}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                sortBy={sortBy}
                onSortChange={onSortChange}
                onOpenFilters={onOpenFilters}
                onClearFilters={onResetFilters}
                scrollResetKey={scrollResetKey}
                showFilterBar={false}
                activeFiltersCount={activeFiltersCount}
                onViewModeChange={onViewModeChange}
              />
            </div>
            <CatalogBulkModals
              sel={selection}
              selectionMode={selectionMode}
              totalCount={totalEstimate || filteredProducts.length}
            />
          </ProductLeafCategoryProvider>
        </SparklineSalesProvider>
      );
    }

    return (
      <div
        className={cn(
          'relative space-y-8 px-4 pb-12 duration-500 animate-in fade-in sm:px-6',
          isLoadingMore && 'opacity-80 transition-opacity',
        )}
      >
        <SparklineSalesProvider productIds={productIds}>
          <ProductLeafCategoryProvider productIds={productIds}>
            {viewMode === 'table' && (
              <ProductTableView
                scrollResetKey={scrollResetKey}
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
            )}
          </ProductLeafCategoryProvider>
        </SparklineSalesProvider>

        {hasMoreProducts && viewMode === 'table' && (
          <div ref={loadMoreRef} className="pt-4" data-testid="load-more-trigger">
            <ProductTableSkeleton rows={5} selectionMode={selectionMode} />
          </div>
        )}

        <CatalogBulkModals
          sel={selection}
          selectionMode={selectionMode}
          totalCount={totalEstimate || filteredProducts.length}
        />
      </div>
    );
  },
);
