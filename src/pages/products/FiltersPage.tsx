import { useNavigate } from 'react-router-dom';
import { useCallback, useState, useRef, lazy, Suspense } from 'react';
import { SharePreviewDialog } from '@/components/products/share/SharePreviewDialog';
import { VariantPickerDialog } from '@/components/products/VariantPickerDialog';
import { type ExternalVariantStock, type Product } from '@/hooks/products';

import { PageSEO } from '@/components/seo/PageSEO';
import { FilterPanel, type FilterState, defaultFilters } from '@/components/filters/FilterPanel';
import { SORT_OPTIONS } from '@/constants/filters';
import { PresetsBar } from '@/components/filters/PresetsBar';
import { VirtualizedProductGrid } from '@/components/products/VirtualizedProductGrid';
import { ProductList } from '@/components/products/ProductList';
import { ProductTableView } from '@/components/products/ProductTableView';
import { ColumnSelector } from '@/components/products/ColumnSelector';
import { BulkActionBar } from '@/components/products/BulkActionBar';
import { BulkAddToCartModal } from '@/components/catalog/BulkAddToCartModal';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Filter, ArrowUpDown, X, CheckSquare, SearchX, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LayoutPopover } from '@/components/products/LayoutPopover';
import { SmartSearchInput } from '@/components/search';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import type { VoiceAgentAction } from '@/hooks/voice/types';
import { useOracleVoiceBridge } from '@/stores/oracleVoiceBridge';
import { toast } from 'sonner';
import { useFiltersPageState } from '@/pages/filters/useFiltersPageState';
import { useFiltersSelectionMode } from '@/pages/filters/useFiltersSelectionMode';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const LazyVoiceOverlay = lazy(() => import('@/components/search/VoiceSearchOverlayConnected'));

export default function FiltersPage() {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { isInCompare, toggleCompare, canAddMore } = useComparisonStore();

  const state = useFiltersPageState();
  const sel = useFiltersSelectionMode({
    selectionMode: state.selectionMode,
    filteredProducts: state.filteredProducts,
  });
  const openOracle = useOracleVoiceBridge((s) => s.openOracle);

  // ========== SHARE STATE ==========
  const [shareProduct, setShareProduct] = useState<Product | null>(null);
  const [variantForShare, setVariantForShare] = useState<ExternalVariantStock | null | undefined>(
    undefined,
  );
  const variantSelectedRef = useRef(false);

  // ========== VOICE ==========
  const handleVoiceAction = useCallback(
    (action: VoiceAgentAction) => {
      if (action.action === 'open_oracle') {
        openOracle(action.data?.oracleMessage || undefined);
        toast.success(action.response);
        return;
      }
      if (action.action === 'open_cart') {
        // Trigger cart sidebar via keyboard shortcut event
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', altKey: true }));
        toast.success(action.response);
        return;
      }

      if (!action.data) return;

      if (action.action === 'filter' && action.data.filters) {
        const f = action.data.filters;
        state.setFilters((prev: FilterState) => {
          const next = { ...prev };
          if (f.color) next.colors = [...prev.colors, f.color];
          if (f.category) next.categories = [...prev.categories, f.category];
          if (f.material) next.materiais = [...prev.materiais, f.material];
          if (f.maxPrice) next.priceRange = [prev.priceRange[0], f.maxPrice];
          if (f.minPrice) next.priceRange = [f.minPrice, prev.priceRange[1]];
          if (f.inStock) next.inStock = true;
          if (f.isKit) next.isKit = true;
          return next;
        });
        toast.success(action.response);
      } else if (action.action === 'search' && action.data.query) {
        const query = action.data.query;
        state.setFilters((prev: FilterState) => ({ ...prev, search: query }));
        toast.success(action.response);
      } else if (action.action === 'sort' && action.data.sortBy) {
        const sortMap: Record<string, string> = {
          'price-asc': 'price-asc',
          'price-desc': 'price-desc',
          name: 'name',
          stock: 'stock',
          newest: 'newest',
          popularity: 'popularity',
        };
        const sortValue = sortMap[action.data.sortBy] || 'name';
        state.setSortBy(sortValue);
        toast.success(action.response);
      } else if (action.action === 'clear') {
        state.setFilters(defaultFilters);
        toast.success(action.response);
      } else if (action.action === 'navigate' && action.data.route) {
        navigate(action.data.route);
        toast.success(action.response);
      }
    },
    [state, navigate, openOracle],
  );

  const toggleSelectionMode = useCallback(() => {
    state.setSelectionMode((prev: boolean) => !prev);
  }, [state]);

  return (
    <>
      <PageSEO
        title="Filtros de Produtos"
        description="Filtre e encontre brindes por cor, categoria, preço e fornecedor."
        path="/produtos"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="sticky top-4 hidden max-h-[calc(100vh-6rem)] w-80 shrink-0 overflow-hidden rounded-b-xl lg:flex lg:flex-col">
            <div className="scrollbar-thin relative min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
              <FilterPanel
                filters={state.filters}
                onFilterChange={state.handleFilterChange}
                onReset={state.handleReset}
                activeFiltersCount={state.activeFiltersCount}
                products={state.realProducts}
                filteredResultsCount={state.filteredProducts.length}
              />
              {/* Bottom fade gradient for scroll indication */}
              <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
            </div>
            <div className="shrink-0 space-y-2 border-t border-border/40 bg-card px-3 py-2.5">
              {/* Loading progress bar */}
              <AnimatePresence>
                {!state.isFullyLoaded &&
                  state.loadingProgress > 0 &&
                  state.loadingProgress < 100 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-1 overflow-hidden"
                    >
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-primary/70"
                          initial={{ width: 0 }}
                          animate={{ width: `${state.loadingProgress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                      <p className="text-center text-[10px] tabular-nums text-muted-foreground">
                        Carregando {state.loadedCount.toLocaleString('pt-BR')} de{' '}
                        {(state.totalEstimate ?? 0).toLocaleString('pt-BR')} produtos (
                        {state.loadingProgress}%)
                      </p>
                    </motion.div>
                  )}
              </AnimatePresence>
              <div
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${state.activeFiltersCount > 0 ? 'bg-gradient-to-r from-brand-primary to-brand-primary-hover text-brand-primary-foreground shadow-md shadow-brand-primary/20' : 'bg-muted/60 text-muted-foreground'}`}
              >
                <Filter className="h-4 w-4" />
                <span className="tabular-nums">
                  {state.isLoadingProducts && state.realProducts.length === 0
                    ? 'Carregando catálogo...'
                    : state.activeFiltersCount > 0
                      ? `Ver ${state.filteredProducts.length.toLocaleString('pt-BR')} resultado${state.filteredProducts.length !== 1 ? 's' : ''}`
                      : `${(state.totalEstimate ?? state.filteredProducts.length).toLocaleString('pt-BR')}${!state.isFullyLoaded ? '+' : ''} produtos disponíveis`}
                </span>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-shrink-0">
                <h1
                  data-testid="page-title-produtos"
                  className="whitespace-nowrap font-display text-xl font-bold sm:text-2xl lg:text-3xl"
                >
                  Super Filtro
                  <span className="ml-2 inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground sm:text-base">
                    ·{' '}
                    <span className="tabular-nums">
                      {state.isLoadingProducts && state.realProducts.length === 0
                        ? 'carregando...'
                        : `${(state.activeFiltersCount > 0 ? state.filteredProducts.length : (state.totalEstimate ?? state.filteredProducts.length)).toLocaleString('pt-BR')}${!state.isFullyLoaded && state.activeFiltersCount === 0 ? '+' : ''} itens`}
                    </span>
                    {!state.isFullyLoaded &&
                      state.loadingProgress > 0 &&
                      state.loadingProgress < 100 &&
                      state.activeFiltersCount === 0 && (
                        <span className="ml-1 inline-flex items-center gap-1">
                          <span className="inline-block h-1 w-12 overflow-hidden rounded-full bg-muted/50 align-middle">
                            <motion.span
                              className="block h-full rounded-full bg-primary/60"
                              initial={{ width: 0 }}
                              animate={{ width: `${state.loadingProgress}%` }}
                              transition={{ duration: 0.4, ease: 'easeOut' }}
                            />
                          </span>
                          <span className="text-[10px] tabular-nums opacity-60">
                            {state.loadingProgress}%
                          </span>
                        </span>
                      )}
                  </span>
                </h1>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <SmartSearchInput
                  placeholder="Buscar produtos..."
                  onSelect={(result) =>
                    result.type === 'product'
                      ? navigate(`/produto/${result.id}`)
                      : state.handleFilterChange({ ...state.filters, search: result.label })
                  }
                  onSearch={(q) => state.handleFilterChange({ ...state.filters, search: q })}
                  className="flex-1"
                />
                {(state.filters.search || state.searchParams.get('search')) && (
                  <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                    {state.isLoadingProducts && state.realProducts.length === 0
                      ? 'Carregando...'
                      : `${state.filteredProducts.length.toLocaleString('pt-BR')} encontrado${state.filteredProducts.length !== 1 ? 's' : ''}`}
                  </Badge>
                )}
                <Sheet open={state.mobileFiltersOpen} onOpenChange={state.setMobileFiltersOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <SheetTrigger asChild>
                          <Button variant="outline" size="sm" className="shrink-0 lg:hidden">
                            <Filter className="mr-2 h-4 w-4" />
                            Filtros
                            {state.activeFiltersCount > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {state.activeFiltersCount}
                              </Badge>
                            )}
                          </Button>
                        </SheetTrigger>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Abrir painel de filtros detalhados</TooltipContent>
                  </Tooltip>
                  <SheetContent side="left" className="flex w-80 flex-col p-0">
                    <SheetHeader className="px-6 pb-2 pt-6">
                      <SheetTitle>Filtros</SheetTitle>
                    </SheetHeader>
                    <div className="relative flex-1 overflow-y-auto px-6 pb-4">
                      <FilterPanel
                        filters={state.filters}
                        onFilterChange={state.handleFilterChange}
                        onReset={state.handleReset}
                        activeFiltersCount={state.activeFiltersCount}
                        products={state.realProducts}
                        filteredResultsCount={state.filteredProducts.length}
                      />
                      <div className="pointer-events-none sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
                    </div>
                    <div className="shrink-0 space-y-2 border-t border-border/40 bg-card px-4 py-3">
                      {!state.isFullyLoaded &&
                        state.loadingProgress > 0 &&
                        state.loadingProgress < 100 && (
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              animate={{ width: `${state.loadingProgress}%` }}
                              transition={{ duration: 0.4 }}
                            />
                          </div>
                        )}
                      <div className="flex gap-2">
                        {state.activeFiltersCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={state.handleReset}
                            className="shrink-0 text-xs"
                          >
                            Limpar ({state.activeFiltersCount})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="flex-1 tabular-nums"
                          onClick={() => state.setMobileFiltersOpen(false)}
                        >
                          <Filter className="mr-1.5 h-3.5 w-3.5" />
                          {state.isLoadingProducts && state.realProducts.length === 0
                            ? 'Carregando...'
                            : state.activeFiltersCount > 0
                              ? `Ver ${state.filteredProducts.length.toLocaleString('pt-BR')} resultado${state.filteredProducts.length !== 1 ? 's' : ''}`
                              : `${(state.totalEstimate ?? state.filteredProducts.length).toLocaleString('pt-BR')} produtos`}
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={state.sortBy} onValueChange={state.setSortBy}>
                      <SelectTrigger
                        className="w-44 shrink-0 sm:w-52"
                        aria-label="Ordenar produtos"
                      >
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        {SORT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    Ordenar resultados (nome, preço, novidades, popularidade)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <PresetsBar
                        currentFilters={state.filters}
                        onApplyPreset={(f, id) => state.handleApplyPreset(f, id)}
                        activePresetId={state.activePresetId}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Presets de filtros salvos para acesso rápido</TooltipContent>
                </Tooltip>

                {/* Selection toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={state.selectionMode ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'relative h-8 gap-1.5 transition-all',
                        state.selectionMode
                          ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90'
                          : 'hover:border-primary/50',
                      )}
                      onClick={toggleSelectionMode}
                      aria-label={
                        state.selectionMode ? 'Cancelar seleção' : 'Ativar modo de seleção em massa'
                      }
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span className="hidden text-xs sm:inline">
                        {state.selectionMode ? 'Cancelar' : 'Selecionar'}
                      </span>
                      <AnimatePresence>
                        {state.selectionMode && sel.selectedCount > 0 && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="absolute -right-2 -top-2"
                          >
                            <Badge className="flex h-5 min-w-5 items-center justify-center bg-destructive px-1.5 py-0 text-[10px] font-bold tabular-nums text-destructive-foreground shadow-lg">
                              {sel.selectedCount}
                            </Badge>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {state.selectionMode
                      ? 'Sair do modo de seleção'
                      : 'Selecionar vários produtos para ações em massa'}
                  </TooltipContent>
                </Tooltip>

                <div className="hidden shrink-0 sm:block">
                  <LayoutPopover
                    viewMode={state.viewMode}
                    setViewMode={state.setViewMode}
                    gridColumns={state.gridColumns}
                    setGridColumns={state.setGridColumns}
                  />
                </div>
              </div>
              {state.activeFiltersSummary.length > 0 && (
                <div className="hidden w-full flex-wrap items-center gap-1.5 sm:flex">
                  {state.activeFiltersSummary.slice(0, 3).map((filter) => (
                    <Badge
                      key={filter.key}
                      variant="secondary"
                      className="cursor-pointer gap-1 px-2 py-0.5 text-xs hover:bg-destructive/20"
                      onClick={() => state.clearSingleFilter(filter.key)}
                    >
                      {filter.label}: {filter.value} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                  {state.activeFiltersSummary.length > 3 && (
                    <Badge variant="outline" className="px-2 py-0.5 text-xs">
                      +{state.activeFiltersSummary.length - 3}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={state.handleReset}
                    className="h-6 px-2 text-xs text-muted-foreground"
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {/* Products */}
            <div className="relative min-h-[calc(100vh-10rem)]">
              {state.isFiltering && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/50 pt-32 backdrop-blur-[1px] transition-opacity duration-200">
                  <div className="flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 shadow-sm">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">Filtrando...</span>
                  </div>
                </div>
              )}
              {(state.isLoadingProducts && state.realProducts.length === 0) ||
              state.filteredProducts.length > 0 ? (
                <>
                  {state.viewMode === 'grid' ? (
                    <VirtualizedProductGrid
                      products={state.filteredProducts}
                      isLoading={state.isLoadingProducts}
                      onProductClick={(productId) =>
                        state.selectionMode
                          ? sel.toggleSelect(productId)
                          : navigate(`/produto/${productId}`)
                      }
                      isFavorited={isFavorite}
                      onToggleFavorite={toggleFavorite}
                      isInCompare={isInCompare}
                      onToggleCompare={toggleCompare}
                      canAddToCompare={canAddMore}
                      onShare={(product) => setShareProduct(product)}
                      columns={state.gridColumns}
                      columnSelector={
                        <ColumnSelector value={state.gridColumns} onChange={state.setGridColumns} />
                      }
                      activeFiltersCount={state.activeFiltersCount}
                      sortBy={state.sortBy}
                      onSortChange={state.setSortBy}
                      onOpenFilters={() => state.setMobileFiltersOpen(true)}
                      onClearFilters={state.handleReset}
                      viewMode={state.viewMode}
                      onViewModeChange={state.setViewMode}
                      showFilterBar={false}
                      activeColorFilter={
                        state.filters.colorGroups.length > 0 ||
                        state.filters.colorVariations.length > 0
                          ? {
                              groups: state.filters.colorGroups,
                              variations: state.filters.colorVariations,
                            }
                          : null
                      }
                      selectionMode={state.selectionMode}
                      selectedIds={sel.selectedIds}
                      onToggleSelect={sel.toggleSelect}
                    />
                  ) : state.viewMode === 'list' ? (
                    <div className="scrollbar-products h-[calc(100vh-280px)] min-h-[500px] overflow-y-auto rounded-xl border border-border/40 bg-gradient-to-b from-background/80 to-background/40 p-4 shadow-inner backdrop-blur-sm">
                      <ProductList
                        products={state.filteredProducts}
                        isLoading={state.isLoadingProducts}
                        onProductClick={(productId) =>
                          state.selectionMode
                            ? sel.toggleSelect(productId)
                            : navigate(`/produto/${productId}`)
                        }
                        onShareProduct={(product) => setShareProduct(product)}
                        isFavorite={isFavorite}
                        onToggleFavorite={toggleFavorite}
                        isInCompare={isInCompare}
                        onToggleCompare={toggleCompare}
                        canAddToCompare={canAddMore}
                        activeColorFilter={
                          state.filters.colorGroups.length > 0 ||
                          state.filters.colorVariations.length > 0
                            ? {
                                groups: state.filters.colorGroups,
                                variations: state.filters.colorVariations,
                              }
                            : null
                        }
                        selectionMode={state.selectionMode}
                        externalSelectedIds={sel.selectedIds}
                        onToggleSelect={sel.toggleSelect}
                      />
                    </div>
                  ) : (
                    <div className="h-[calc(100vh-280px)] min-h-[500px] overflow-y-auto rounded-xl border border-border/40 bg-gradient-to-b from-background/80 to-background/40 shadow-inner backdrop-blur-sm">
                      <ProductTableView
                        products={state.filteredProducts}
                        isLoading={state.isLoadingProducts}
                        onProductClick={(productId) =>
                          state.selectionMode
                            ? sel.toggleSelect(productId)
                            : navigate(`/produto/${productId}`)
                        }
                        isFavorite={isFavorite}
                        onToggleFavorite={toggleFavorite}
                        isInCompare={isInCompare}
                        onToggleCompare={toggleCompare}
                        canAddToCompare={canAddMore}
                        onShareProduct={(product) => setShareProduct(product)}
                        activeColorFilter={
                          state.filters.colorGroups.length > 0 ||
                          state.filters.colorVariations.length > 0
                            ? {
                                groups: state.filters.colorGroups,
                                variations: state.filters.colorVariations,
                              }
                            : null
                        }
                        selectionMode={state.selectionMode}
                        selectedIds={sel.selectedIds}
                        onToggleSelect={sel.toggleSelect}
                      />
                    </div>
                  )}

                  {/* Bulk Action Bar */}
                  {state.selectionMode && (
                    <BulkActionBar
                      selectedCount={sel.selectedIds.size}
                      totalCount={state.filteredProducts.length}
                      onSelectAll={sel.selectAll}
                      onClearSelection={sel.clearSelection}
                      onBulkFavorite={sel.handleBulkFavorite}
                      onBulkCompare={sel.handleBulkCompare}
                      onBulkCollection={sel.handleBulkCollection}
                      onBulkQuote={sel.handleBulkQuote}
                      onBulkCart={sel.handleBulkCart}
                    />
                  )}

                  {sel.firstSelectedProduct && (
                    <AddToCollectionModal
                      open={sel.collectionModalOpen}
                      onOpenChange={(open) => {
                        sel.setCollectionModalOpen(open);
                        if (!open) sel.clearSelection();
                      }}
                      productId={sel.firstSelectedId}
                      productName={`${sel.selectedIds.size} produtos selecionados`}
                    />
                  )}
                  <BulkAddToCartModal
                    open={sel.cartModalOpen}
                    onOpenChange={sel.setCartModalOpen}
                    products={sel.bulkCartProducts}
                    variantSelections={sel.wizardSelections}
                    onDone={sel.clearSelection}
                  />
                  <BulkVariantWizard
                    open={sel.variantWizardOpen}
                    onOpenChange={sel.setVariantWizardOpen}
                    products={sel.bulkCartProducts}
                    mode={sel.wizardMode}
                    onComplete={sel.handleWizardComplete}
                  />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-gradient-to-b from-muted/20 to-muted/5 py-16 text-center">
                  <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40">
                    <SearchX className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    Nenhum produto encontrado
                  </h3>
                  <p className="mx-auto mb-6 mt-1.5 max-w-sm text-sm text-muted-foreground">
                    {state.activeFiltersCount > 1
                      ? 'A combinação de filtros não retornou resultados. Tente remover algum filtro.'
                      : 'Tente ajustar os filtros ou buscar por outro termo.'}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" onClick={state.handleReset} className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Limpar filtros
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {state.voiceOverlayOpen && (
        <Suspense fallback={null}>
          <LazyVoiceOverlay
            isOpen={state.voiceOverlayOpen}
            onClose={() => state.setVoiceOverlayOpen(false)}
            onAction={handleVoiceAction}
          />
        </Suspense>
      )}

      {/* Step 1: Variant picker for share */}
      {shareProduct && variantForShare === undefined && (
        <VariantPickerDialog
          open
          onOpenChange={(open) => {
            if (!open && !variantSelectedRef.current) {
              setShareProduct(null);
            }
            variantSelectedRef.current = false;
          }}
          productId={shareProduct.id}
          productName={shareProduct.name}
          mode="share"
          onComplete={(variant) => {
            variantSelectedRef.current = true;
            setVariantForShare(variant ?? null);
          }}
        />
      )}

      {/* Step 2: Share dialog after variant is chosen */}
      {shareProduct && variantForShare !== undefined && (
        <SharePreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setShareProduct(null);
              setVariantForShare(undefined);
              variantSelectedRef.current = false;
            }
          }}
          product={shareProduct}
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
