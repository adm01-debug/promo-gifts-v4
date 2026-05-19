import { ProductCard } from "./ProductCard";
import type { Product } from "@/hooks/products";
import type { ActiveColorFilter } from "@/utils/color-image-resolver";
import { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/hooks/ui";
import { SelectionCheckbox } from "@/components/common/SelectionCheckbox";
import { cn } from "@/lib/utils";
import { ProductGridSkeleton } from "./ProductCardSkeleton";
import type { ColumnCount } from "./ColumnSelector";

export interface ProductGridProps {
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
  hideCategoryBadges?: boolean;
  activeColorFilter?: ActiveColorFilter | null;
  columns?: number;
  /** Selection mode props */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function ProductCardWrapper({ 
  product, 
  index, 
  isVisible,
  hideCategoryBadges,
  selectionMode,
  selectedIds,
  onToggleSelect,
  ...restProps 
}: { 
  product: Product; 
  index: number; 
  isVisible: boolean;
  hideCategoryBadges?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
} & Omit<React.ComponentProps<typeof ProductCard>, 'product'>) {
  const reducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(reducedMotion);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) { setHasAnimated(true); return; }
    if (!hasAnimated) {
      const timer = setTimeout(() => setHasAnimated(true), Math.min(index * 80, 800));
      return () => clearTimeout(timer);
    }
  }, [hasAnimated, index, reducedMotion]);

  const isSelected = selectionMode && selectedIds?.has(product.id);

  return (
    <div
      ref={ref}
      className={cn(
        reducedMotion ? '' : `transition-all duration-500 ease-out ${
          hasAnimated ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
        }`,
        "relative",
        isSelected && "ring-2 ring-primary/40 rounded-xl"
      )}
      style={reducedMotion ? undefined : {
        transitionDelay: hasAnimated ? '0ms' : `${Math.min(index * 80, 800)}ms`,
      }}
    >
      {selectionMode && onToggleSelect && (
        <div 
          className="absolute top-2 left-2 z-20"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(product.id); }}
        >
          <SelectionCheckbox
            checked={!!isSelected}
            onChange={() => onToggleSelect(product.id)}
            size="md"
          />
        </div>
      )}
      <ProductCard 
        product={product} 
        hideCategoryBadges={hideCategoryBadges} 
        {...restProps}
        onClick={selectionMode ? () => onToggleSelect?.(product.id) : restProps.onClick}
      />
    </div>
  );
}

const columnClasses: Record<number, string> = {
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  8: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
};

export function ProductGrid({ 
  products,
  isLoading,
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
  hideCategoryBadges = false,
  activeColorFilter,
  columns = 5,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: ProductGridProps) {
  const [isGridVisible, setIsGridVisible] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    // Reset animation state when products change
    setIsGridVisible(false);
    const timer = setTimeout(() => setIsGridVisible(true), 50);
    return () => clearTimeout(timer);
  }, [products, isLoading]);

  if (isLoading) {
    return (
      <ProductGridSkeleton 
        count={products.length > 0 ? products.length : 10} 
        columns={columns as ColumnCount} 
      />
    );
  }

  if (products.length === 0) {
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

  return (
    <div 
      ref={gridRef}
      className={`grid ${columnClasses[columns] || columnClasses[5]} ${columns >= 8 ? 'gap-x-4 gap-y-8' : columns >= 6 ? 'gap-x-6 gap-y-8' : 'gap-x-8 gap-y-8'}`}
    >
      {products.map((product, index) => (
        <ProductCardWrapper
          key={product.id}
          product={product}
          index={index}
          isVisible={isGridVisible}
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
          hideCategoryBadges={hideCategoryBadges}
          activeColorFilter={activeColorFilter}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}