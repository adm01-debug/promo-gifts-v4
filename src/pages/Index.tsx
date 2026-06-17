// Catálogo de Produtos - Index Page (v3 - refactored)
import { useState, useRef, useMemo, useCallback } from 'react';

import { PageSEO } from '@/components/seo/PageSEO';
import { FloatingCompareBar } from '@/components/compare/FloatingCompareBar';
import { SharePreviewDialog } from '@/components/products/share/SharePreviewDialog';
import { VariantPickerDialog } from '@/components/products/VariantPickerDialog';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { CatalogActiveFilters } from '@/components/catalog/CatalogActiveFilters';
import { CatalogContent } from '@/components/catalog/CatalogContent';
import { useCatalogState } from '@/hooks/products/useCatalogState';
import type { FilterState } from '@/components/filters/FilterPanel';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';

export default function Index() {
  const catalog = useCatalogState();
  const [variantForShare, setVariantForShare] = useState<ExternalVariantStock | null | undefined>(
    undefined,
  );
  const variantSelectedRef = useRef(false);

  const activeColorFilter = useMemo(
    () =>
      catalog.filters.colorGroups?.length > 0 || catalog.filters.colorVariations?.length > 0
        ? {
            groups: catalog.filters.colorGroups ?? [],
            variations: catalog.filters.colorVariations ?? [],
          }
        : null,
    [catalog.filters.colorGroups, catalog.filters.colorVariations],
  );

  const { navigate: catalogNavigate, setFilters, handleSearch } = catalog;
  const handleHeaderSelect = useCallback(
    (result: { type: string; id: string; label: string }) => {
      if (result.type === 'product') {
        catalogNavigate(`/produto/${result.id}`);
      } else if (result.type === 'category') {
        setFilters((prev: FilterState) => ({ ...prev, categories: [result.id] }));
      } else if (result.type === 'supplier') {
        setFilters((prev: FilterState) => ({ ...prev, suppliers: [result.id] }));
      } else {
        handleSearch(result.label);
      }
    },
    [catalogNavigate, setFilters, handleSearch],
  );

  // Dynamic JSON-LD based on current state
  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: catalog.searchQuery
        ? `Resultados para "${catalog.searchQuery}" - Catálogo`
        : 'Catálogo de Brindes Promocionais',
      description: catalog.searchQuery
        ? `Encontramos ${catalog.filteredProducts.length} brindes promocionais para sua busca "${catalog.searchQuery}".`
        : 'Explore nosso catálogo com mais de 15.000 brindes personalizáveis. Filtre por categoria, material, cor e preço.',
      url: window.location.href,
      numberOfItems: catalog.totalEstimate || catalog.filteredProducts.length,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: catalog.paginatedProducts.slice(0, 10).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${window.location.origin}/produto/${p.id}`,
          name: p.name,
        })),
      },
    }),
    [
      catalog.searchQuery,
      catalog.filteredProducts.length,
      catalog.totalEstimate,
      catalog.paginatedProducts,
    ],
  );

  return (
    <>
      <PageSEO
        title={catalog.searchQuery ? `Busca: ${catalog.searchQuery}` : 'Catálogo de Produtos'}
        description={
          catalog.searchQuery
            ? `Resultados de busca para ${catalog.searchQuery} em Brindes Promocionais. Melhores preços e variedades.`
            : 'Explore nosso catálogo com mais de 15.000 brindes promocionais. Filtre por categoria, cor e preço.'
        }
        path="/"
        jsonLd={structuredData}
      />
      <div className="animate-fade-in space-y-3 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-5">
        {/* Header: Title + Search */}
        <CatalogHeader
          shouldShowCatalogSkeleton={catalog.shouldShowCatalogSkeleton}
          totalEstimate={catalog.totalEstimate}
          filteredCount={catalog.filteredProducts.length}
          hasNextPage={catalog.hasNextPage}
          searchQuery={catalog.searchQuery}
          activeFiltersCount={catalog.activeFiltersCount}
          onReset={catalog.resetFilters}
          searchHistory={catalog.searchHistory}
          onClearHistory={catalog.clearHistory}
          onSelect={handleHeaderSelect}
        />

        {/* Toolbar: Filters + Sort + Stats + Layout — sticky abaixo do Header global.
            Usa --header-h + --breadcrumb-h (definidos por Header/MainLayout) para
            acompanhar a altura dinâmica em qualquer rota. */}
        <div className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-20 -mx-4 border-b border-transparent bg-background/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 [&:not(:first-child)]:border-border/30">
          <CatalogToolbar
            filters={catalog.filters}
            setFilters={catalog.setFilters}
            activeFiltersCount={catalog.activeFiltersCount}
            filterSheetOpen={catalog.filterSheetOpen}
            setFilterSheetOpen={catalog.setFilterSheetOpen}
            resetFilters={catalog.resetFilters}
            sortBy={catalog.sortBy}
            setSortBy={catalog.setSortBy}
            statBadges={catalog.statBadges}
            viewMode={catalog.viewMode}
            setViewMode={catalog.setViewMode}
            gridColumns={catalog.gridColumns}
            setGridColumns={catalog.setGridColumns}
            selectionMode={catalog.selectionMode}
            onToggleSelectionMode={catalog.toggleSelectionMode}
            selectedCount={catalog.selectedCount}
          />
        </div>

        {/* Active filter badges */}
        <CatalogActiveFilters
          filters={catalog.filters}
          setFilters={catalog.setFilters}
          activeFiltersCount={catalog.activeFiltersCount}
        />

        {/* Product grid/list content */}
        <CatalogContent
          viewMode={catalog.viewMode}
          shouldShowCatalogSkeleton={catalog.shouldShowCatalogSkeleton}
          shouldShowEmptyState={catalog.shouldShowEmptyState}
          hasActiveCatalogConstraints={catalog.hasActiveCatalogConstraints}
          paginatedProducts={catalog.paginatedProducts}
          filteredProducts={catalog.filteredProducts}
          gridColumns={catalog.gridColumns}
          hasMoreProducts={catalog.hasMoreProducts}
          isLoadingMore={catalog.isLoadingMore}
          totalEstimate={catalog.totalEstimate}
          loadMoreRef={catalog.loadMoreRef}
          itemsPerPage={catalog.ITEMS_PER_PAGE}
          navigate={catalog.navigate}
          handleViewProduct={catalog.handleViewProduct}
          handleShareProduct={catalog.handleShareProduct}
          handleFavoriteProduct={catalog.handleFavoriteProduct}
          isFavorite={catalog.isFavorite}
          toggleFavorite={catalog.toggleFavorite}
          isInCompare={catalog.isInCompare}
          onToggleCompare={catalog.toggleCompare}
          canAddToCompare={catalog.canAddMore}
          onLoadMore={catalog.loadMore}
          onResetFilters={catalog.resetFilters}
          selectionMode={catalog.selectionMode}
          onSelectedCountChange={catalog.setSelectedCount}
          activeColorFilter={activeColorFilter}
          sortBy={catalog.sortBy}
          onSortChange={catalog.setSortBy}
          onOpenFilters={() => catalog.setFilterSheetOpen(true)}
          activeFiltersCount={catalog.activeFiltersCount}
          onViewModeChange={catalog.setViewMode}
          scrollResetKey={catalog.scrollResetKey}
        />
      </div>

      <FloatingCompareBar />

      {/* Step 1: Variant picker for share */}
      {catalog.shareProduct && variantForShare === undefined && (
        <VariantPickerDialog
          open
          onOpenChange={(open) => {
            if (!open && !variantSelectedRef.current) {
              catalog.setShareProduct(null);
            }
            variantSelectedRef.current = false;
          }}
          productId={catalog.shareProduct.id}
          productName={catalog.shareProduct.name}
          mode="share"
          onComplete={(variant) => {
            variantSelectedRef.current = true;
            setVariantForShare(variant ?? null);
          }}
        />
      )}

      {/* Step 2: Share dialog after variant is chosen */}
      {catalog.shareProduct && variantForShare !== undefined && (
        <SharePreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              catalog.setShareProduct(null);
              setVariantForShare(undefined);
              variantSelectedRef.current = false;
            }
          }}
          product={catalog.shareProduct}
          selectedVariant={
            variantForShare
              ? {
                  variantName: variantForShare.color_name,
                  colorHex: variantForShare.color_hex,
                  thumbnailUrl: variantForShare.selected_thumbnail,
                }
              : null
          }
        />
      )}
    </>
  );
}
