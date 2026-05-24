import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getGridColsClass } from '@/components/replenishments/VirtualizedReplenishmentGrid';
import type { ColumnCount } from '@/components/products/ColumnSelector';

interface ProductCardSkeletonProps {
  /** Variant of skeleton - matches card content structure */
  variant?: 'default' | 'compact' | 'detailed';
  /** Whether to show the shimmer animation */
  animate?: boolean;
}

export function ProductCardSkeleton({
  variant = 'default',
  animate: _animate = true,
}: ProductCardSkeletonProps) {
  const baseClass = '';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm',
        baseClass,
      )}
    >
      {/* Image skeleton - matches aspect-[4/5] */}
      <div className="relative aspect-[4/5] bg-muted/40">
        {/* Shimmer overlay */}
        <div className="bg-shimmer pointer-events-none absolute inset-0 animate-shimmer" />

        {/* Badges placeholder - top left */}
        <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          <Skeleton className="h-4 w-14 rounded-full opacity-60 sm:h-5 sm:w-16" />
        </div>

        {/* Action buttons placeholder - top right */}
        {variant === 'detailed' && (
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        )}

        {/* Colors placeholder - bottom */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-1 rounded-full border border-border/20 bg-card/60 px-2 py-1.5 backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:py-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-full opacity-70 sm:h-5 sm:w-5" />
            ))}
            <Skeleton className="ml-1 h-3 w-5 opacity-50" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="space-y-3 p-4">
        {/* Category & supplier */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16 opacity-50" />
          <Skeleton className="h-4 w-14 rounded-full opacity-60 sm:h-5 sm:w-16" />
        </div>

        {/* Title - two lines */}
        <div className="min-h-[2.25rem] space-y-1.5 sm:min-h-[2.75rem]">
          <Skeleton className="h-4 w-full sm:h-5" />
          <Skeleton className="h-4 w-3/4 opacity-60 sm:h-5" />
        </div>

        {/* Price and stock row */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-12 opacity-50" />
            <Skeleton className="h-6 w-24 opacity-80" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full opacity-60" />
            <Skeleton className="h-3 w-10 opacity-40" />
          </div>
        </div>

        {/* Materials */}
        {variant !== 'compact' && (
          <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
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
  variant?: 'default' | 'compact' | 'detailed';
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
  variant = 'default',
  stagger = false,
  columns = 5,
}: ProductGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid',
        getGridColsClass(columns),
        columns >= 8
          ? 'gap-x-4 gap-y-8'
          : columns >= 6
            ? 'gap-x-6 gap-y-8'
            : 'gap-x-4 gap-y-8 sm:gap-x-6 lg:gap-x-8',
        'will-change-transform',
      )}
    >
      {[...Array(count)].map((_, i) => (
        <div key={i} style={stagger ? { animationDelay: `${i * 75}ms` } : undefined} className="">
          <ProductCardSkeleton variant={variant} />
        </div>
      ))}
    </div>
  );
}

// Inline skeleton for loading states in smaller contexts
export function ProductCardInlineSkeleton() {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-border/40 bg-card p-3">
      <div className="bg-shimmer pointer-events-none absolute inset-0 animate-shimmer" />
      <Skeleton className="h-16 w-16 shrink-0 rounded-lg bg-muted/40" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 opacity-80" />
        <Skeleton className="h-3 w-1/2 opacity-50" />
        <Skeleton className="h-4 w-16 opacity-70" />
      </div>
    </div>
  );
}
