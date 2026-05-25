import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getGridColsClass } from "@/components/replenishments/grid-layout";
import type { ColumnCount } from "@/components/products/ColumnSelector";

interface ProductCardSkeletonProps {
  /** Variant of skeleton - matches card content structure */
  variant?: "default" | "compact" | "detailed";
  /** Whether to show the shimmer animation */
  animate?: boolean;
}

export function ProductCardSkeleton({ 
  variant = "default",
  animate = true 
}: ProductCardSkeletonProps) {
  const baseClass = "";

  return (
    <div className={cn("rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm", baseClass)}>
      {/* Image skeleton - matches aspect-[4/5] */}
      <div className="relative aspect-[4/5] bg-muted/40">
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-shimmer animate-shimmer pointer-events-none" />
        
        {/* Badges placeholder - top left */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 sm:gap-1.5">
          <Skeleton className="h-4 sm:h-5 w-14 sm:w-16 rounded-full opacity-60" />
        </div>

        {/* Action buttons placeholder - top right */}
        {variant === "detailed" && (
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        )}

        {/* Colors placeholder - bottom */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-card/60 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1.5 sm:py-2 border border-border/20">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-4 sm:h-5 w-4 sm:w-5 rounded-full opacity-70" />
            ))}
            <Skeleton className="h-3 w-5 ml-1 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Category & supplier */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16 opacity-50" />
          <Skeleton className="h-4 sm:h-5 w-14 sm:w-16 rounded-full opacity-60" />
        </div>
        
        {/* Title - two lines */}
        <div className="space-y-1.5 min-h-[2.25rem] sm:min-h-[2.75rem]">
          <Skeleton className="h-4 sm:h-5 w-full" />
          <Skeleton className="h-4 sm:h-5 w-3/4 opacity-60" />
        </div>
        
        {/* Price and stock row */}
        <div className="flex items-end justify-between pt-1 gap-2">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-12 opacity-50" />
            <Skeleton className="h-6 w-24 opacity-80" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Skeleton className="h-5 w-20 rounded-full opacity-60" />
            <Skeleton className="h-3 w-10 opacity-40" />
          </div>
        </div>

        {/* Materials */}
        {variant !== "compact" && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

interface ProductGridSkeletonProps {
  /** Quantidade de cards (default = ITEMS_PER_PAGE = 12 para casar com a primeira página) */
  count?: number;
  variant?: "default" | "compact" | "detailed";
  /**
   * Animação escalonada — desativada por padrão para evitar percepção
   * de delay em listas grandes (memory `[Loading Standard]`).
   */
  stagger?: boolean;
  /** Espelha exatamente as colunas do grid real para evitar layout shift. */
  columns?: ColumnCount;
}

export function ProductGridSkeleton({
  count = 12,
  variant = "default",
  stagger = false,
  columns = 5,
}: ProductGridSkeletonProps) {
  return (
    <div className={cn("grid", getGridColsClass(columns), columns >= 8 ? 'gap-x-4 gap-y-8' : columns >= 6 ? 'gap-x-6 gap-y-8' : 'gap-x-4 sm:gap-x-6 lg:gap-x-8 gap-y-8', "will-change-transform")}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          style={stagger ? { animationDelay: `${i * 75}ms` } : undefined}
          className=""
        >
          <ProductCardSkeleton variant={variant} />
        </div>
      ))}
    </div>
  );
}

// Inline skeleton for loading states in smaller contexts
export function ProductCardInlineSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40 relative overflow-hidden">
      <div className="absolute inset-0 bg-shimmer animate-shimmer pointer-events-none" />
      <Skeleton className="h-16 w-16 rounded-lg shrink-0 bg-muted/40" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 opacity-80" />
        <Skeleton className="h-3 w-1/2 opacity-50" />
        <Skeleton className="h-4 w-16 opacity-70" />
      </div>
    </div>
  );
}
