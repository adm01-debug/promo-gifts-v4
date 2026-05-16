import { useRef, useCallback, useEffect, useState, useMemo, memo, type RefObject } from 'react';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, ArrowUp, Keyboard, X, AlertCircle } from 'lucide-react';
import { useProductsContextSafe } from '@/contexts/ProductsContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { AnimatePresence, motion } from 'framer-motion';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductListItem } from '@/components/products/ProductListItem';
import { ProductTableView } from '@/components/products/ProductTableView';
import { ProductGridSkeleton } from '@/components/products/ProductCardSkeleton';
import { ProductListSkeleton } from '@/components/products/ProductListItemSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { CatalogBulkModals } from './CatalogBulkModals';
import { useCatalogSelection } from './useCatalogSelection';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useProducts';
import type { ViewMode } from '@/hooks/useCatalogState';
import type { ColumnCount } from '@/components/products/ColumnSelector';
import { SparklineSalesProvider } from '@/hooks/useSparklineSales';

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

// ScrollToTopButton migrado para src/components/common/ScrollToTopButton.tsx
import { ScrollToTopButton } from '@/components/common/ScrollToTopButton';

function VirtualFooter({
  hasMore,
  loadMoreRef,
  productsCount,
  totalEstimate,
  filteredCount,
  isLoadingMore,
  itemsPerPage,
  skeletonType,
  columns,
}: {
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement>;
  productsCount: number;
  totalEstimate: number | null;
  filteredCount: number;
  isLoadingMore: boolean;
  itemsPerPage: number;
  skeletonType: 'grid' | 'list';
  columns: ColumnCount;
}) {
  const total = (totalEstimate ?? filteredCount).toLocaleString('pt-BR');
  if (hasMore)
    return (
      <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-8">
        <div ref={loadMoreRef} style={{ minHeight: '1px' }} />
        <p className="text-sm text-muted-foreground">
          Mostrando {productsCount} de {total} produtos
        </p>
        {isLoadingMore &&
          (skeletonType === 'grid' ? (
            <ProductGridSkeleton count={Math.min(itemsPerPage, columns * 2)} columns={columns} />
          ) : (
            <ProductListSkeleton count={3} />
          ))}
      </div>
    );
  if (productsCount > itemsPerPage)
    return (
      <p className="pb-4 pt-8 text-center text-sm text-muted-foreground">
        Todos os {total} produtos foram carregados ✓
      </p>
    );
  return null;
}

function useScrollableContainer(hasMore: boolean, isLoadingMore: boolean, onLoadMore?: () => void) {
  const parentRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    if (hasMore && !isLoadingMore && onLoadMore && scrollHeight - scrollTop - clientHeight < 500)
      onLoadMore();
  }, [hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return { parentRef };
}

const CONTAINER_CLASS =
  'h-[calc(100vh-200px)] min-h-[550px] overflow-y-auto rounded-xl border border-border/40 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-sm scrollbar-products shadow-inner';

function VirtualGrid({
  products,
  columns,
  navigate: _navigate,
  handleViewProduct,
  handleShareProduct,
  isFavorite,
  toggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare,
  hasMore,
  isLoadingMore,
  totalEstimate,
  filteredCount,
  loadMoreRef,
  itemsPerPage,
  onLoadMore,
  selectionMode,
  selectedIds,
  onToggleSelect,
  activeColorFilter,
  activeProductId,
  setActiveProductId,
}: {
  products: Product[];
  columns: ColumnCount;
  navigate: (p: string) => void;
  handleViewProduct: (p: Product) => void;
  handleShareProduct: (p: Product) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isInCompare: (id: string) => boolean;
  onToggleCompare: (id: string) => { added: boolean; isFull: boolean };
  canAddToCompare: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalEstimate: number | null;
  filteredCount: number;
  loadMoreRef: RefObject<HTMLDivElement>;
  itemsPerPage: number;
  onLoadMore?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  activeColorFilter?: ActiveColorFilter | null;
  activeProductId?: string | null;
  setActiveProductId?: (id: string | null) => void;
}) {
  const { parentRef } = useScrollableContainer(
    hasMore,
    isLoadingMore,
    onLoadMore,
  );
  const rowCount = Math.ceil(products.length / columns);

  const estimateRowHeight = useCallback(() => {
    if (columns <= 1) return 520;
    if (columns <= 2) return 500;
    if (columns >= 8) return 380;
    if (columns >= 6) return 420;
    if (columns >= 5) return 460;
    return 500;
  }, [columns]);

  const virtualizer = useVirtualizer({
    count: rowCount + 1,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateRowHeight,
    overscan: 3,
  });
  const gap = columns >= 8 ? 16 : columns >= 6 ? 24 : 32;

  // Auto-scroll to active product
  useEffect(() => {
    if (activeProductId && parentRef.current) {
      const idx = products.findIndex((p) => p.id === activeProductId);
      if (idx !== -1) {
        const rowIdx = Math.floor(idx / columns);
        virtualizer.scrollToIndex(rowIdx, { align: 'center', behavior: 'smooth' });
      }
    }
  }, [activeProductId, products, columns, virtualizer, parentRef]);

  return (
    <div className="relative h-full">
      <div ref={parentRef} className={CONTAINER_CLASS} style={{ contain: 'strict' }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            padding: '1rem',
          }}
        >
          {virtualizer.getVirtualItems().map((vr) => {
            if (vr.index === rowCount)
              return (
                <div
                  key="footer"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <VirtualFooter
                    hasMore={hasMore}
                    loadMoreRef={loadMoreRef}
                    productsCount={products.length}
                    totalEstimate={totalEstimate}
                    filteredCount={filteredCount}
                    isLoadingMore={isLoadingMore}
                    itemsPerPage={itemsPerPage}
                    skeletonType="grid"
                    columns={columns}
                  />
                </div>
              );
            const startIdx = vr.index * columns;
            const rowProducts = products.slice(startIdx, startIdx + columns);
            return (
              <div
                key={vr.key}
                data-index={vr.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vr.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  columnGap: `${gap}px`,
                  paddingBottom: `${gap}px`,
                }}
              >
                {rowProducts.map((product) => {
                  const isSelected = selectionMode && selectedIds?.has(product.id);
                  const isActive = activeProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className="relative"
                      onMouseEnter={() => setActiveProductId?.(product.id)}
                    >
                      {selectionMode && (
                        <div className="absolute left-2.5 top-2.5 z-20">
                          <SelectionCheckbox
                            checked={!!isSelected}
                            onChange={() => onToggleSelect?.(product.id)}
                            size="lg"
                            animateEntry
                          />
                        </div>
                      )}
                      <div
                        className={cn(
                          'rounded-xl transition-all duration-200',
                          isSelected &&
                            'shadow-[0_0_12px_-4px_hsl(var(--primary)/0.3)] ring-2 ring-primary/50',
                          isActive && 'z-10 scale-[1.01] shadow-lg ring-2 ring-primary',
                        )}
                      >
                        <ProductCard
                          product={product}
                          onClick={() => {
                            if (selectionMode) {
                              onToggleSelect?.(product.id);
                            } else {
                              handleViewProduct(product);
                            }
                          }}
                          onView={handleViewProduct}
                          onShare={handleShareProduct}
                          isFavorited={isFavorite(product.id)}
                          onToggleFavorite={toggleFavorite}
                          isInCompare={isInCompare(product.id)}
                          onToggleCompare={onToggleCompare}
                          canAddToCompare={canAddToCompare}
                          activeColorFilter={activeColorFilter}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ScrollToTopButton containerRef={parentRef} className="absolute bottom-4 right-4 h-10 w-10 sm:bottom-4 sm:right-4" />
    </div>
  );
}

function VirtualList({
  products,
  navigate: _navigate,
  handleViewProduct,
  handleShareProduct,
  isFavorite,
  toggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare,
  hasMore,
  isLoadingMore,
  totalEstimate,
  filteredCount,
  loadMoreRef,
  itemsPerPage,
  onLoadMore,
  selectionMode,
  selectedIds,
  onToggleSelect,
  activeColorFilter,
  activeProductId,
  setActiveProductId,
}: {
  products: Product[];
  navigate: (p: string) => void;
  handleViewProduct: (p: Product) => void;
  handleShareProduct: (p: Product) => void;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isInCompare: (id: string) => boolean;
  onToggleCompare: (id: string) => { added: boolean; isFull: boolean };
  canAddToCompare: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  totalEstimate: number | null;
  filteredCount: number;
  loadMoreRef: RefObject<HTMLDivElement>;
  itemsPerPage: number;
  onLoadMore?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  activeColorFilter?: ActiveColorFilter | null;
  activeProductId?: string | null;
  setActiveProductId?: (id: string | null) => void;
}) {
  const { parentRef } = useScrollableContainer(
    hasMore,
    isLoadingMore,
    onLoadMore,
  );
  const rowCount = products.length;
  const virtualizer = useVirtualizer({
    count: rowCount + 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  useEffect(() => {
    if (activeProductId && parentRef.current) {
      const idx = products.findIndex((p) => p.id === activeProductId);
      if (idx !== -1) virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
    }
  }, [activeProductId, products, virtualizer, parentRef]);

  return (
    <div className="relative h-full">
      <div ref={parentRef} className={CONTAINER_CLASS} style={{ contain: 'strict' }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            padding: '1rem',
          }}
        >
          {virtualizer.getVirtualItems().map((vr) => {
            if (vr.index === rowCount)
              return (
                <div
                  key="footer"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <VirtualFooter
                    hasMore={hasMore}
                    loadMoreRef={loadMoreRef}
                    productsCount={products.length}
                    totalEstimate={totalEstimate}
                    filteredCount={filteredCount}
                    isLoadingMore={isLoadingMore}
                    itemsPerPage={itemsPerPage}
                    skeletonType="list"
                    columns={5}
                  />
                </div>
              );
            const product = products[vr.index];
            if (!product) return null;
            const isSelected = selectionMode && selectedIds?.has(product.id);
            const isActive = activeProductId === product.id;
            return (
              <div
                key={vr.key}
                data-index={vr.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vr.start}px)`,
                  paddingBottom: '8px',
                }}
                onMouseEnter={() => setActiveProductId?.(product.id)}
              >
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl transition-all duration-200',
                    isSelected && 'bg-primary/5 ring-2 ring-primary/40',
                    isActive && 'bg-primary/10 shadow-md ring-2 ring-primary',
                  )}
                >
                  {selectionMode && (
                    <div className="ml-1 flex-shrink-0">
                      <SelectionCheckbox
                        checked={!!isSelected}
                        onChange={() => onToggleSelect?.(product.id)}
                        size="md"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <ProductListItem
                      product={product}
                      onClick={() =>
                        selectionMode ? onToggleSelect?.(product.id) : handleViewProduct(product)
                      }
                      onView={handleViewProduct}
                      onShare={handleShareProduct}
                      isFavorited={isFavorite(product.id)}
                      onToggleFavorite={toggleFavorite}
                      isInCompare={isInCompare(product.id)}
                      onToggleCompare={onToggleCompare}
                      canAddToCompare={canAddToCompare}
                      activeColorFilter={activeColorFilter}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ScrollToTopButton containerRef={parentRef} className="absolute bottom-4 right-4 h-10 w-10 sm:bottom-4 sm:right-4" />
    </div>
  );
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
  itemsPerPage,
  navigate,
  handleViewProduct,
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
  activeProductId,
  setActiveProductId,
}: CatalogContentProps) {
  const ctx = useProductsContextSafe();
  const sparklineProductIds = useMemo(
    () => paginatedProducts.map((p) => p.id),
    [paginatedProducts],
  );
  const sel = useCatalogSelection(paginatedProducts, selectionMode, onSelectedCountChange);

  const [showKbdTip, setShowKbdTip] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowKbdTip(true), 2000);
    const hideTimer = setTimeout(() => setShowKbdTip(false), 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  const sharedProps = useMemo(
    () => ({
      products: paginatedProducts,
      navigate,
      handleViewProduct,
      handleShareProduct,
      isFavorite,
      toggleFavorite,
      isInCompare,
      onToggleCompare,
      canAddToCompare,
      hasMore: hasMoreProducts,
      isLoadingMore,
      totalEstimate,
      filteredCount: filteredProducts.length,
      loadMoreRef,
      itemsPerPage,
      onLoadMore,
      selectionMode,
      selectedIds: sel.selectedIds,
      onToggleSelect: sel.toggleSelect,
      activeColorFilter,
      activeProductId,
      setActiveProductId,
    }),
    [
      paginatedProducts,
      navigate,
      handleViewProduct,
      handleShareProduct,
      isFavorite,
      toggleFavorite,
      isInCompare,
      onToggleCompare,
      canAddToCompare,
      hasMoreProducts,
      isLoadingMore,
      totalEstimate,
      filteredProducts.length,
      loadMoreRef,
      itemsPerPage,
      onLoadMore,
      selectionMode,
      sel.selectedIds,
      sel.toggleSelect,
      activeColorFilter,
      activeProductId,
      setActiveProductId,
    ],
  );

  const renderContent = () => {
    // Missing Context Fallback (HMR or Race Condition)
    if (!ctx) {
      return (
        <div
          className={cn(
            CONTAINER_CLASS,
            'flex flex-col items-center justify-center gap-6 p-8 text-center',
          )}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-muted">
              <AlertCircle className="h-10 w-10 animate-pulse text-muted-foreground" />
            </div>
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="font-display text-xl font-bold">Conectando ao Catálogo</h3>
            <p className="text-muted-foreground">
              O módulo de produtos está sendo inicializado. Se esta mensagem persistir, tente
              recarregar a página.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              size="sm"
              className="gap-2"
            >
              <Loader2 className="h-3.5 w-3.5" />
              Recarregar Página
            </Button>
            <div className="mt-4 flex w-full justify-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      );
    }

    if (shouldShowCatalogSkeleton) {
      return (
        <div className={`${CONTAINER_CLASS} p-4`}>
          {viewMode === 'grid' ? (
            <ProductGridSkeleton count={itemsPerPage} columns={gridColumns} />
          ) : (
            <ProductListSkeleton count={viewMode === 'table' ? 12 : 8} />
          )}
        </div>
      );
    }

    if (shouldShowEmptyState) {
      return (
        <div className={`${CONTAINER_CLASS} p-4`}>
          <EmptyState
            variant={hasActiveCatalogConstraints ? 'search' : 'products'}
            title={
              hasActiveCatalogConstraints
                ? 'Nenhum produto encontrado'
                : 'Catálogo indisponível no momento'
            }
            description={
              hasActiveCatalogConstraints
                ? 'Tente ajustar os filtros, remover termos da busca ou buscar em todas as categorias.'
                : 'O catálogo ainda não retornou itens para exibição.'
            }
            action={
              hasActiveCatalogConstraints && onResetFilters
                ? { label: 'Limpar tudo e ver catálogo completo', onClick: onResetFilters }
                : undefined
            }
            className="min-h-[420px]"
          />
        </div>
      );
    }

    if (paginatedProducts.length === 0 && isLoadingMore) {
      return (
        <div className={`${CONTAINER_CLASS} p-4`}>
          <div className="flex h-full flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="animate-pulse font-medium text-muted-foreground">
              Sincronizando catálogo...
            </p>
            <div className="w-full max-w-md opacity-50">
              <ProductGridSkeleton count={gridColumns} columns={gridColumns} />
            </div>
          </div>
        </div>
      );
    }

    switch (viewMode) {
      case 'table':
        return (
          <ProductTableView
            products={paginatedProducts}
            onProductClick={(id) => navigate(`/produto/${id}`)}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            isInCompare={isInCompare}
            onToggleCompare={onToggleCompare}
            canAddToCompare={canAddToCompare}
            onShareProduct={handleShareProduct}
            selectionMode={selectionMode}
            selectedIds={sel.selectedIds}
            onToggleSelect={sel.toggleSelect}
            activeColorFilter={activeColorFilter}
            hasMore={hasMoreProducts}
            isLoadingMore={isLoadingMore}
            totalEstimate={totalEstimate}
            filteredCount={filteredProducts.length}
            loadMoreRef={loadMoreRef}
            itemsPerPage={itemsPerPage}
            onLoadMore={onLoadMore}
            activeProductId={activeProductId}
            setActiveProductId={setActiveProductId}
          />
        );
      case 'list':
        return (
          <SparklineSalesProvider productIds={sparklineProductIds}>
            <VirtualList {...sharedProps} />
          </SparklineSalesProvider>
        );
      default:
        return (
          <SparklineSalesProvider productIds={sparklineProductIds}>
            <VirtualGrid {...sharedProps} columns={gridColumns} />
          </SparklineSalesProvider>
        );
    }
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {showKbdTip && !activeProductId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute -top-12 right-0 z-30 hidden items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary/90 px-3 py-1.5 text-[10px] font-medium text-primary-foreground shadow-lg backdrop-blur-sm lg:flex"
          >
            <Keyboard className="h-3 w-3" />
            <span>
              Use <kbd className="rounded bg-white/20 px-1">J</kbd> /{' '}
              <kbd className="rounded bg-white/20 px-1">K</kbd> para navegar rapidamente
            </span>
            <button onClick={() => setShowKbdTip(false)} className="ml-1 hover:text-white/60">
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {renderContent()}
      <CatalogBulkModals
        sel={sel}
        selectionMode={selectionMode}
        totalCount={paginatedProducts.length}
      />
    </div>
  );
});

CatalogContent.displayName = 'CatalogContent';
