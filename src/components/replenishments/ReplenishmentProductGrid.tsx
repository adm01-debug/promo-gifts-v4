import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Package, AlertTriangle } from 'lucide-react';
import {
  replenishmentToProduct,
  useReplenishmentsSelectionMode,
  useReplenishmentsWithDetails,
} from '@/hooks/products';
import { useProductsColorsBatch } from '@/hooks/products/useProductsColorsBatch';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import { BulkActionBar } from '@/components/products/BulkActionBar';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import { BulkAddToCartModal } from '@/components/catalog/BulkAddToCartModal';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { AnimatePresence, m as motion } from 'framer-motion';
import { ReplenishmentTableView } from './ReplenishmentCards';
import { ReplenishmentToolbar } from './ReplenishmentToolbar';
import { getGridColsClass, getGridGapClass } from './grid-layout';
import { VirtualizedReplenishmentGrid } from './VirtualizedReplenishmentGrid';
import { VirtualizedReplenishmentList } from './VirtualizedReplenishmentList';
import { ReplenishmentCardSkeleton } from './ReplenishmentCardSkeleton';
import { ProductCardSkeleton } from '@/components/loading/ModernSkeletons';

type ViewMode = 'grid' | 'list' | 'table';
type SortMode = 'name' | 'price-asc' | 'price-desc' | 'newest' | 'stock';

function useLoadingProgress(isLoading: boolean): number {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return prev;
          }
          return prev + Math.random() * 12 + 3;
        });
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      const t = setTimeout(() => setProgress(0), 800);
      return () => clearTimeout(t);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading]);

  return progress;
}

export function ReplenishmentProductGrid() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);

  const {
    data: replenishments,
    isLoading,
    isFetching,
    error,
  } = useReplenishmentsWithDetails({ limit: 200 });
  const products = useMemo(() => replenishments ?? [], [replenishments]);
  const loadingProgress = useLoadingProgress(isLoading);

  const { suppliers, categories } = useMemo(() => {
    const supMap = new Map<string, { id: string; name: string; count: number }>();
    const catMap = new Map<string, { id: string; name: string; count: number }>();
    for (const p of products) {
      if (p.supplier_id && p.supplier_name) {
        const e = supMap.get(p.supplier_id);
        if (e) e.count++;
        else supMap.set(p.supplier_id, { id: p.supplier_id, name: p.supplier_name, count: 1 });
      }
      if (p.category_id && p.category_name) {
        const e = catMap.get(p.category_id);
        if (e) e.count++;
        else catMap.set(p.category_id, { id: p.category_id, name: p.category_name, count: 1 });
      }
    }
    return {
      suppliers: [...supMap.values()].sort((a, b) => b.count - a.count),
      categories: [...catMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          p.product_sku?.toLowerCase().includes(q) ||
          p.supplier_name?.toLowerCase().includes(q),
      );
    }
    if (selectedSupplier !== 'all')
      filtered = filtered.filter((p) => p.supplier_id === selectedSupplier);
    if (selectedCategory !== 'all')
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    filtered.sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.product_name.localeCompare(b.product_name, 'pt-BR');
        case 'price-asc':
          return (a.base_price ?? 0) - (b.base_price ?? 0);
        case 'price-desc':
          return (b.base_price ?? 0) - (a.base_price ?? 0);
        case 'stock':
          return b.stock_quantity - a.stock_quantity;
        case 'newest':
        default:
          return new Date(b.replenished_at).getTime() - new Date(a.replenished_at).getTime();
      }
    });
    return filtered;
  }, [products, selectedSupplier, selectedCategory, sortMode, searchQuery]);

  const sel = useReplenishmentsSelectionMode({ selectionMode, filteredProducts });
  const hasActiveFilters =
    selectedSupplier !== 'all' || selectedCategory !== 'all' || searchQuery.trim() !== '';

  const handleProductClick = useCallback((id: string) => navigate(`/produto/${id}`), [navigate]);
  const clearFilters = useCallback(() => {
    setSelectedSupplier('all');
    setSelectedCategory('all');
    setSearchQuery('');
  }, []);
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) sel.clearSelection();
      return !prev;
    });
  }, [sel]);

  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const {
    isInCompare,
    addToCompare,
    removeFromCompare,
    canAddMore: canAddToCompare,
  } = useComparisonStore();

  const onToggleCompare = useCallback(
    (productId: string) => {
      if (isInCompare(productId)) {
        removeFromCompare(productId);
        return { added: false, isFull: false };
      }
      const result = addToCompare(productId);
      return { added: !!result, isFull: !canAddToCompare };
    },
    [isInCompare, addToCompare, removeFromCompare, canAddToCompare],
  );

  const productMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof replenishmentToProduct>>();
    for (const n of filteredProducts) map.set(n.product_id, replenishmentToProduct(n));
    return map;
  }, [filteredProducts]);

  // Batch-load cores das variantes para os produtos visíveis
  const visibleProductIds = useMemo(
    () => filteredProducts.map((p) => p.product_id),
    [filteredProducts],
  );
  const { data: colorsByProduct } = useProductsColorsBatch(visibleProductIds);

  // Enriquece o productMap (usado pelo list-view via ProductListItem) com as cores carregadas
  const enrichedProductMap = useMemo(() => {
    if (!colorsByProduct || colorsByProduct.size === 0) return productMap;
    const next = new Map(productMap);
    for (const [id, prod] of next) {
      const c = colorsByProduct.get(id);
      if (c?.length) {
        next.set(id, {
          ...prod,
          colors: c.map((x) => ({ name: x.name, hex: x.hex ?? '', group: '' })),
        });
      }
    }
    return next;
  }, [productMap, colorsByProduct]);

  const renderContent = () => {
    if (isLoading && products.length === 0) {
      return (
        <div className="space-y-4" role="status" aria-label="Carregando produtos">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Carregando {Math.round(loadingProgress)}% dos produtos…
            </span>
          </div>
          <div
            className="mb-4 h-1.5 w-64 overflow-hidden rounded-full bg-muted/50"
            role="progressbar"
            aria-valuenow={Math.round(loadingProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div
            className={cn(
              'grid',
              viewMode === 'list'
                ? 'grid-cols-1 gap-2'
                : `${getGridColsClass(gridColumns)} ${getGridGapClass(gridColumns)}`,
            )}
          >
            {Array.from({ length: 15 }, (_, i) =>
              viewMode === 'list' ? (
                <ProductCardSkeleton key={i} variant="compact" />
              ) : (
                <ReplenishmentCardSkeleton key={i} />
              ),
            )}
          </div>
        </div>
      );
    }

    if (error && products.length === 0) {
      return (
        <div className="py-10 text-center" role="alert">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">Erro ao carregar reposições</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Tente recarregar a página</p>
        </div>
      );
    }

    if (filteredProducts.length === 0) {
      return (
        <div className="py-10 text-center" role="status">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80">
            <Package className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {hasActiveFilters
              ? 'Nenhuma reposição com esses filtros'
              : 'Nenhuma reposição encontrada'}
          </p>
          {hasActiveFilters ? (
            <Button variant="link" className="mt-1 text-xs" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/70">
              Produtos repostos aparecerão aqui automaticamente
            </p>
          )}
        </div>
      );
    }

    if (viewMode === 'table') {
      return (
        <ReplenishmentTableView
          products={filteredProducts}
          onProductClick={handleProductClick}
          selectionMode={selectionMode}
          selectedIds={sel.selectedIds}
          onToggleSelect={sel.toggleSelect}
          colorsByProduct={colorsByProduct}
        />
      );
    }

    if (viewMode === 'list') {
      return (
        <VirtualizedReplenishmentList
          products={filteredProducts}
          productMap={enrichedProductMap}
          selectionMode={selectionMode}
          selectedIds={sel.selectedIds}
          onToggleSelect={sel.toggleSelect}
          onProductClick={handleProductClick}
          isFavorite={isFavorite}
          toggleFavorite={toggleFavorite}
          isInCompare={isInCompare}
          onToggleCompare={onToggleCompare}
          canAddToCompare={canAddToCompare}
        />
      );
    }

    return (
      <VirtualizedReplenishmentGrid
        products={filteredProducts}
        gridColumns={gridColumns}
        selectionMode={selectionMode}
        selectedIds={sel.selectedIds}
        onToggleSelect={sel.toggleSelect}
        onProductClick={handleProductClick}
        colorsByProduct={colorsByProduct}
      />
    );
  };

  return (
    <div className="space-y-3">
      <ReplenishmentToolbar
        totalCount={products.length}
        filteredCount={filteredProducts.length}
        isLoading={isLoading}
        loadingProgress={loadingProgress}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedSupplier={selectedSupplier}
        onSupplierChange={setSelectedSupplier}
        suppliers={suppliers}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
        sortMode={sortMode}
        onSortChange={setSortMode}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        viewMode={viewMode}
        setViewMode={setViewMode}
        gridColumns={gridColumns}
        setGridColumns={setGridColumns}
        selectionMode={selectionMode}
        onToggleSelectionMode={toggleSelectionMode}
      />

      {!isLoading && filteredProducts.length > 0 && hasActiveFilters && (
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          Mostrando <span className="font-medium text-foreground">{filteredProducts.length}</span>{' '}
          de {products.length} reposições
        </p>
      )}

      <div className="relative">
        {renderContent()}
        <AnimatePresence>
          {isFetching && products.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              role="status"
            >
              <div className="flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 shadow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Filtrando…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectionMode && (
        <BulkActionBar
          selectedCount={sel.selectedCount}
          totalCount={filteredProducts.length}
          onSelectAll={sel.selectAll}
          onClearSelection={sel.clearSelection}
          onBulkFavorite={sel.handleBulkFavorite}
          onBulkCompare={sel.handleBulkCompare}
          onBulkCollection={sel.handleBulkCollection}
          onBulkCart={sel.handleBulkCart}
          onBulkQuote={sel.handleBulkQuote}
        />
      )}
      <BulkVariantWizard
        open={sel.variantWizardOpen}
        onOpenChange={sel.setVariantWizardOpen}
        products={sel.selectedProducts}
        mode={sel.wizardMode}
        onComplete={sel.handleWizardComplete}
      />
      <BulkAddToCartModal
        open={sel.cartModalOpen}
        onOpenChange={sel.setCartModalOpen}
        products={sel.bulkCartProducts}
        variantSelections={sel.wizardSelections}
        onDone={sel.clearSelection}
      />
      <AddToCollectionModal
        open={sel.collectionModalOpen}
        onOpenChange={sel.setCollectionModalOpen}
        productId={sel.firstSelectedId}
        productName={sel.firstSelectedProduct?.product_name ?? ''}
      />
    </div>
  );
}
