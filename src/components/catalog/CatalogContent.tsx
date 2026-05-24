import { memo, type RefObject } from 'react';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { Skeleton } from '@/components/ui/skeleton';


import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductList } from '@/components/products/ProductList';
import { ProductTableView } from '@/components/products/ProductTableView';
import { ProductCardSkeleton } from '@/components/products/ProductCardSkeleton';
import { ProductListItemSkeleton } from '@/components/products/ProductListItemSkeleton';
import { ProductTableSkeleton } from '@/components/products/ProductTableSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { CatalogBulkModals } from './CatalogBulkModals';
import { useCatalogSelection } from './useCatalogSelection';
import { cn } from '@/lib/utils';
import { type Product, type ViewMode } from "@/hooks/products";
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { SparklineSalesProvider } from '@/hooks/intelligence';
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
}: CatalogContentProps) {
  const selection = useCatalogSelection(
    paginatedProducts,
    selectionMode,
    onSelectedCountChange
  );
  const { selectedIds, toggleSelect: onToggleSelect } = selection;

  if (shouldShowCatalogSkeleton) {
    if (viewMode === "list") {
      return (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${i * 30}ms` }}>
              <ProductListItemSkeleton />
            </div>
          ))}
        </div>
      );
    }
    if (viewMode === "table") {
      return <ProductTableSkeleton rows={10} />;
    }
    return (
      <div className={cn("grid", {
        "grid-cols-2 sm:grid-cols-3": gridColumns === 3,
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4": gridColumns === 4,
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5": gridColumns === 5,
        "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6": gridColumns === 6,
        "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8": gridColumns === 8,
      }, gridColumns >= 8 ? 'gap-x-4 gap-y-8' : gridColumns >= 6 ? 'gap-x-6 gap-y-8' : 'gap-x-4 sm:gap-x-6 lg:gap-x-8 gap-y-8')}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-in fade-in duration-300" style={{ animationDelay: `${i * 40}ms` }}>
            <ProductCardSkeleton />
          </div>
        ))}
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
            ? "Tente ajustar seus filtros para ver mais resultados."
            : "Explore nosso catálogo completo para encontrar o que procura."
        }
        action={{
          label: "Limpar todos os filtros",
          onClick: onResetFilters,
        }}
      />
    );
  }

  return (
    <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
      <SparklineSalesProvider>
        {viewMode === "grid" && (
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

        {viewMode === "list" && (
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

        {viewMode === "table" && (
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
        <div
          ref={loadMoreRef}
          className="flex justify-center py-8"
        >
          {isLoadingMore ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <Skeleton className="h-2 w-2 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-xs text-muted-foreground font-medium animate-pulse">
                Carregando mais produtos...
              </p>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Exibindo {Math.min(paginatedProducts.length, totalEstimate || filteredProducts.length)} de {totalEstimate || filteredProducts.length} produtos
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
