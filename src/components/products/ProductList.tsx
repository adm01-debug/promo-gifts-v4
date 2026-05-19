import { useEffect, useState, useCallback } from "react";
import { ProductListItem } from "./ProductListItem";
import { BulkActionBar } from "./BulkActionBar";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { SelectionCheckbox } from "@/components/common/SelectionCheckbox";
import type { Product } from "@/hooks/products";
import type { ActiveColorFilter } from "@/utils/color-image-resolver";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProductCardSkeleton } from "./ProductCardSkeleton";

export interface ProductListProps {
  products: Product[];
  isLoading?: boolean;
  onProductClick?: (productId: string) => void;
  onViewProduct?: (product: Product) => void;
  onShareProduct?: (product: Product) => void;
  onFavoriteProduct?: (product: Product) => void;
  isFavorite?: (productId: string) => boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: (productId: string) => boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  highlightColors?: string[];
  activeColorFilter?: ActiveColorFilter | null;
  /** External selection mode — when provided, internal state is bypassed */
  selectionMode?: boolean;
  /** External selected IDs — controlled externally */
  externalSelectedIds?: Set<string>;
  /** External toggle handler */
  onToggleSelect?: (id: string) => void;
}

function ProductListItemWrapper({
  product,
  index,
  isSelected,
  selectionMode,
  onToggleSelect,
  ...props
}: {
  product: Product;
  index: number;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
} & Omit<React.ComponentProps<typeof ProductListItem>, 'product'>) {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), Math.min(index * 40, 400));
    return () => clearTimeout(timer);
  }, [index]);

    return (
      <div
        className={cn(
          "relative transition-all duration-300 ease-out group/row",
          hasAnimated ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-3",
          isSelected && "ring-2 ring-primary/40 rounded-xl bg-primary/5"
        )}
      >
        <div className={cn(
          "flex items-center gap-2",
          selectionMode && "pl-1"
        )}>
          {selectionMode && (
            <div className="flex-shrink-0">
              <SelectionCheckbox
                checked={isSelected}
                onChange={() => onToggleSelect(product.id)}
                size="md"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <ProductListItem product={product} {...props} />
          </div>
        </div>
      </div>
    );
}

export function ProductList({
  products,
  isLoading = false,
  onProductClick,
  onViewProduct,
  onShareProduct,
  onFavoriteProduct,
  isFavorite,
  onToggleFavorite,
  isInCompare,
  onToggleCompare,
  canAddToCompare = true,
  highlightColors,
  activeColorFilter,
  selectionMode: externalSelectionMode,
  externalSelectedIds,
  onToggleSelect: externalToggleSelect,
}: ProductListProps) {
  // Determine if we're using external or internal selection state
  const isExternallyControlled = externalSelectedIds !== undefined && externalToggleSelect !== undefined;

  // Internal fallback state (only used when NOT externally controlled)
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  // Resolve which state to use
  const selectedIds = isExternallyControlled ? externalSelectedIds : internalSelectedIds;
  const selectionMode = isExternallyControlled ? (externalSelectionMode ?? false) : internalSelectedIds.size > 0;

  // Clear internal selection when products change significantly
  useEffect(() => {
    if (!isExternallyControlled) setInternalSelectedIds(new Set());
  }, [products.length, isExternallyControlled]);

  const toggleSelect = useCallback((id: string) => {
    if (isExternallyControlled) {
      externalToggleSelect!(id);
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, [isExternallyControlled, externalToggleSelect]);

  const selectAll = useCallback(() => {
    if (!isExternallyControlled) {
      setInternalSelectedIds(new Set(products.map((p) => p.id)));
    }
  }, [products, isExternallyControlled]);

  const clearSelection = useCallback(() => {
    if (!isExternallyControlled) {
      setInternalSelectedIds(new Set());
    }
  }, [isExternallyControlled]);

  const handleBulkFavorite = useCallback(() => {
    if (!onToggleFavorite) return;
    let added = 0;
    selectedIds.forEach((id) => {
      if (!isFavorite?.(id)) {
        onToggleFavorite(id);
        added++;
      }
    });
    toast.success(`${added} produto${added > 1 ? "s" : ""} adicionado${added > 1 ? "s" : ""} aos favoritos`);
    clearSelection();
  }, [selectedIds, onToggleFavorite, isFavorite, clearSelection]);

  const handleBulkCompare = useCallback(() => {
    if (!onToggleCompare) return;
    const ids = Array.from(selectedIds).slice(0, 4);
    ids.forEach((id) => {
      if (!isInCompare?.(id)) onToggleCompare(id);
    });
    toast.success(`${ids.length} produto${ids.length > 1 ? "s" : ""} adicionado${ids.length > 1 ? "s" : ""} à comparação`);
    clearSelection();
  }, [selectedIds, onToggleCompare, isInCompare, clearSelection]);

  const handleBulkCollection = useCallback(() => {
    setCollectionModalOpen(true);
  }, []);

  if (products.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-3xl">📦</span>
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          Nenhum produto encontrado
        </h3>
        <p className="text-muted-foreground max-w-md">
          Tente ajustar os filtros ou realizar uma nova busca para encontrar os produtos desejados.
        </p>
      </div>
    );
  }

  const displayProducts = isLoading && products.length === 0
    ? Array.from({ length: 8 }).map((_, i) => ({ id: `skeleton-${i}`, isSkeleton: true } as any))
    : products;

  const skeletonVariant = "compact";


  // Get first selected product for collection modal
  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : "";
  const firstSelectedProduct = products.find((p) => p.id === firstSelectedId);

  return (
    <>
      <div className="flex flex-col gap-2">
        {displayProducts.map((product, index) => (
          (product as any).isSkeleton ? (
            <ProductCardSkeleton key={product.id} variant={skeletonVariant} />
          ) : (
            <ProductListItemWrapper
              key={product.id}
              product={product}
              index={index}
              isSelected={selectedIds.has(product.id)}
              selectionMode={selectionMode}
              onToggleSelect={toggleSelect}
              onClick={onProductClick ? () => onProductClick(product.id) : undefined}
              onView={onViewProduct}
              onShare={onShareProduct}
              onFavorite={onFavoriteProduct}
              isFavorited={isFavorite ? isFavorite(product.id) : false}
              onToggleFavorite={onToggleFavorite}
              isInCompare={isInCompare ? isInCompare(product.id) : false}
              onToggleCompare={onToggleCompare}
              canAddToCompare={canAddToCompare}
              highlightColors={highlightColors}
              activeColorFilter={activeColorFilter}
            />
          )
        ))}
      </div>

      {/* Only render internal BulkActionBar when NOT externally controlled */}
      {!isExternallyControlled && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={products.length}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onBulkFavorite={handleBulkFavorite}
          onBulkCompare={handleBulkCompare}
          onBulkCollection={handleBulkCollection}
        />
      )}

      {!isExternallyControlled && firstSelectedProduct && (
        <AddToCollectionModal
          open={collectionModalOpen}
          onOpenChange={(open) => {
            setCollectionModalOpen(open);
            if (!open) clearSelection();
          }}
          productId={firstSelectedId}
          productName={`${selectedIds.size} produtos selecionados`}
        />
      )}
    </>
  );
}
