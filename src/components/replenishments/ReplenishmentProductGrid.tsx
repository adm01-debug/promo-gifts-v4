import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Package, AlertTriangle } from "lucide-react";
import { replenishmentToProduct, useReplenishmentsSelectionMode, useReplenishmentsWithDetails } from "@/hooks/products";
import { getDefaultColumns, type ColumnCount } from "@/components/products/ColumnSelector";
import { BulkActionBar } from "@/components/products/BulkActionBar";
import { BulkVariantWizard } from "@/components/catalog/BulkVariantWizard";
import { BulkAddToCartModal } from "@/components/catalog/BulkAddToCartModal";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useComparisonStore } from "@/stores/useComparisonStore";
import { AnimatePresence, motion } from "framer-motion";
import { ReplenishmentTableView } from "./ReplenishmentCards";
import { ReplenishmentToolbar } from "./ReplenishmentToolbar";
import { VirtualizedReplenishmentGrid, getGridColsClass, getGridGapClass } from "./VirtualizedReplenishmentGrid";
import { VirtualizedReplenishmentList } from "./VirtualizedReplenishmentList";
import { ProductCardSkeleton } from "@/components/products/ProductCardSkeleton";

type ViewMode = "grid" | "list" | "table";
type SortMode = "name" | "price-asc" | "price-desc" | "newest" | "stock";

function useLoadingProgress(isLoading: boolean): number {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) { if (intervalRef.current) clearInterval(intervalRef.current); return prev; }
          return prev + Math.random() * 12 + 3;
        });
      }, 300);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      const t = setTimeout(() => setProgress(0), 800);
      return () => clearTimeout(t);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLoading]);

  return progress;
}

export function ReplenishmentProductGrid() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);

  const { data: replenishments, isLoading, isFetching, error } = useReplenishmentsWithDetails({ limit: 200 });
  const products = replenishments ?? [];
  const loadingProgress = useLoadingProgress(isLoading);

  const { suppliers, categories } = useMemo(() => {
    const supMap = new Map<string, { id: string; name: string; count: number }>();
    const catMap = new Map<string, { id: string; name: string; count: number }>();
    for (const p of products) {
      if (p.supplier_id && p.supplier_name) {
        const e = supMap.get(p.supplier_id);
        if (e) e.count++; else supMap.set(p.supplier_id, { id: p.supplier_id, name: p.supplier_name, count: 1 });
      }
      if (p.category_id && p.category_name) {
        const e = catMap.get(p.category_id);
        if (e) e.count++; else catMap.set(p.category_id, { id: p.category_id, name: p.category_name, count: 1 });
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
      filtered = filtered.filter(p => p.product_name.toLowerCase().includes(q) || p.product_sku?.toLowerCase().includes(q) || p.supplier_name?.toLowerCase().includes(q));
    }
    if (selectedSupplier !== "all") filtered = filtered.filter(p => p.supplier_id === selectedSupplier);
    if (selectedCategory !== "all") filtered = filtered.filter(p => p.category_id === selectedCategory);
    filtered.sort((a, b) => {
      switch (sortMode) {
        case "name": return a.product_name.localeCompare(b.product_name, 'pt-BR');
        case "price-asc": return (a.base_price ?? 0) - (b.base_price ?? 0);
        case "price-desc": return (b.base_price ?? 0) - (a.base_price ?? 0);
        case "stock": return b.stock_quantity - a.stock_quantity;
        default: return new Date(b.replenished_at).getTime() - new Date(a.replenished_at).getTime();
      }
    });
    return filtered;
  }, [products, selectedSupplier, selectedCategory, sortMode, searchQuery]);

  const sel = useReplenishmentsSelectionMode({ selectionMode, filteredProducts });
  const hasActiveFilters = selectedSupplier !== "all" || selectedCategory !== "all" || searchQuery.trim() !== "";

  const handleProductClick = useCallback((id: string) => navigate(`/produto/${id}`), [navigate]);
  const clearFilters = useCallback(() => { setSelectedSupplier("all"); setSelectedCategory("all"); setSearchQuery(""); }, []);
  const toggleSelectionMode = useCallback(() => { setSelectionMode(prev => { if (prev) sel.clearSelection(); return !prev; }); }, [sel]);

  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const { isInCompare, addToCompare, removeFromCompare, canAdd: canAddToCompare } = useComparisonStore();

  const onToggleCompare = useCallback((productId: string) => {
    if (isInCompare(productId)) { removeFromCompare(productId); return { added: false, isFull: false }; }
    const result = addToCompare(productId);
    return { added: !!result, isFull: !canAddToCompare };
  }, [isInCompare, addToCompare, removeFromCompare, canAddToCompare]);

  const productMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof replenishmentToProduct>>();
    for (const n of filteredProducts) map.set(n.product_id, replenishmentToProduct(n));
    return map;
  }, [filteredProducts]);

  const renderContent = () => {
    if (isLoading && products.length === 0) {
      return (
        <div className="space-y-4" role="status" aria-label="Carregando produtos">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Carregando {Math.round(loadingProgress)}% dos produtos…</span>
          </div>
          <div className="w-64 h-1.5 bg-muted/50 rounded-full overflow-hidden mb-4" role="progressbar" aria-valuenow={Math.round(loadingProgress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
          </div>
          <div className={cn("grid", viewMode === 'list' ? 'grid-cols-1 gap-2' : `${getGridColsClass(gridColumns)} ${getGridGapClass(gridColumns)}`)}>
            {Array.from({ length: 10 }).map((_, i) => (
              <ProductCardSkeleton key={i} variant={viewMode === "list" ? "compact" : "default"} />
            ))}
          </div>
        </div>
      );
    }

    if (error && products.length === 0) {
      return (
        <div className="text-center py-10" role="alert">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-3">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-destructive font-medium text-sm">Erro ao carregar reposições</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Tente recarregar a página</p>
        </div>
      );
    }

    if (filteredProducts.length === 0) {
      return (
        <div className="text-center py-10" role="status">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/80 mb-3">
            <Package className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium text-sm">
            {hasActiveFilters ? "Nenhuma reposição com esses filtros" : "Nenhuma reposição encontrada"}
          </p>
          {hasActiveFilters ? (
            <Button variant="link-primary" className="mt-1 text-xs" onClick={clearFilters}>Limpar filtros</Button>
          ) : (
            <p className="text-xs text-muted-foreground/70 mt-1">Produtos repostos aparecerão aqui automaticamente</p>
          )}
        </div>
      );
    }

    if (viewMode === "table") {
      return <ReplenishmentTableView products={filteredProducts} onProductClick={handleProductClick} selectionMode={selectionMode} selectedIds={sel.selectedIds} onToggleSelect={sel.toggleSelect} />;
    }

    if (viewMode === "list") {
      return (
        <VirtualizedReplenishmentList
          products={filteredProducts}
          productMap={productMap}
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
          Mostrando <span className="font-medium text-foreground">{filteredProducts.length}</span> de {products.length} reposições
        </p>
      )}

      <div className="relative">
        {renderContent()}
        <AnimatePresence>
          {isFetching && products.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" role="status">
              <div className="flex items-center gap-2 px-4 py-2 bg-background/90 border rounded-full shadow-sm">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Filtrando…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectionMode && (
        <BulkActionBar selectedCount={sel.selectedCount} totalCount={filteredProducts.length} onSelectAll={sel.selectAll} onClearSelection={sel.clearSelection} onBulkFavorite={sel.handleBulkFavorite} onBulkCompare={sel.handleBulkCompare} onBulkCollection={sel.handleBulkCollection} onBulkCart={sel.handleBulkCart} onBulkQuote={sel.handleBulkQuote} />
      )}
      <BulkVariantWizard open={sel.variantWizardOpen} onOpenChange={sel.setVariantWizardOpen} products={sel.selectedProducts} mode={sel.wizardMode} onComplete={sel.handleWizardComplete} />
      <BulkAddToCartModal open={sel.cartModalOpen} onOpenChange={sel.setCartModalOpen} products={sel.bulkCartProducts} variantSelections={sel.wizardSelections} onDone={sel.clearSelection} />
      <AddToCollectionModal open={sel.collectionModalOpen} onOpenChange={sel.setCollectionModalOpen} productId={sel.firstSelectedId} productName={sel.firstSelectedProduct?.product_name ?? ""} />
    </div>
  );
}
