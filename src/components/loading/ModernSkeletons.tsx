import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface ProductCardSkeletonProps {
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
  animate?: boolean;
  hideCategoryBadges?: boolean;
  selectionMode?: boolean;
}

export function ProductCardSkeleton({
  variant = 'default',
  className,
  animate = true,
  hideCategoryBadges = false,
  selectionMode = false,
}: ProductCardSkeletonProps) {
  if (variant === 'compact') {
    return (
      <div
        className={cn('flex items-center gap-2', selectionMode && 'pl-1')}
        data-testid="product-card-skeleton"
      >
        {selectionMode && (
          <div className="flex-shrink-0">
            <Skeleton className="h-5 w-5 rounded" animate={animate} />
          </div>
        )}
        <div
          className={cn(
            'flex h-[80px] flex-1 items-center gap-3 overflow-hidden rounded-xl border border-border/40 bg-card p-3 sm:h-[96px] sm:gap-4 sm:p-4',
            className,
          )}
        >
          <Skeleton
            className="h-14 w-14 shrink-0 rounded-lg sm:h-[72px] sm:w-[72px]"
            animate={animate}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-16" animate={animate} />
              <Skeleton className="h-3 w-12" animate={animate} />
            </div>
            <Skeleton className="h-5 w-3/4" animate={animate} />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" animate={animate} />
              <Skeleton className="hidden h-3.5 w-16 sm:block" animate={animate} />
            </div>
          </div>
          <div className="min-w-[80px] shrink-0 space-y-1 text-right sm:min-w-[100px]">
            <Skeleton className="ml-auto h-6 w-16" animate={animate} />
            <Skeleton className="ml-auto h-3 w-12" animate={animate} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-full" animate={animate} />
            <Skeleton className="hidden h-8 w-8 rounded-full sm:block" animate={animate} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="product-card-skeleton"
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/40 bg-card sm:rounded-2xl',
        className,
      )}
    >
      {selectionMode && (
        <div className="absolute left-2 top-2 z-20">
          <Skeleton className="h-5 w-5 rounded" animate={animate} />
        </div>
      )}

      {/* Image Section - Matches ProductCardImage: white product canvas + 4/5 ratio */}
      <div className="product-img-container relative aspect-[4/5] w-full overflow-hidden bg-white">
        <Skeleton
          className="absolute inset-0 h-full w-full rounded-none bg-muted/20"
          animate={animate}
        />
      </div>

      {/* Info Section - Synchronized with ProductCard.tsx */}
      <div className="relative flex flex-1 flex-col space-y-2.5 bg-background p-3 sm:space-y-4 sm:p-5">
        {/* Category badge */}
        {!hideCategoryBadges && <Skeleton className="h-5 w-20 rounded-full" animate={animate} />}

        {/* SKU & Meta Row */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16" animate={animate} />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-8 rounded-md" animate={animate} />
            <Skeleton className="h-5 w-24 rounded-lg" animate={animate} />
          </div>
        </div>

        {/* Title - Fixed min-height to prevent layout shift - Matches product-card-styles.ts */}
        <div className="min-h-[2.5rem] space-y-1.5 sm:min-h-[3rem]">
          <Skeleton className="h-5 w-full" animate={animate} />
          <Skeleton className="h-5 w-2/3" animate={animate} />
        </div>

        {/* Price Section - Fixed min-height Matches product-card-styles.ts */}
        <div className="flex min-h-[3.25rem] flex-col justify-end sm:min-h-[3.75rem]">
          <Skeleton className="mb-1 h-3 w-16" animate={animate} />
          <Skeleton className="h-6 w-24" animate={animate} />
        </div>

        {/* Footer: Price & Actions */}
        <div className="mt-auto flex items-center justify-between border-t border-border/30 pt-2">
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" animate={animate} />
            <Skeleton className="h-2 w-full max-w-[100px]" animate={animate} />
          </div>
          <Skeleton className="h-8 w-8 rounded-full" animate={animate} />
        </div>
      </div>
    </div>
  );
}

const gridColumnClasses: Record<number, string> = {
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  8: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
};

export function ProductGridSkeleton({
  count = 15,
  variant = 'default',
  columns = 5,
  className,
  hideCategoryBadges = false,
  selectionMode = false,
}: {
  count?: number;
  variant?: 'default' | 'compact' | 'detailed';
  columns?: number;
  className?: string;
  hideCategoryBadges?: boolean;
  selectionMode?: boolean;
}) {
  // Use the exact same gap logic as ProductGrid.tsx for layout stability
  const gapClass =
    columns >= 8
      ? 'gap-x-4 gap-y-8'
      : columns >= 6
        ? 'gap-x-6 gap-y-8'
        : 'gap-x-4 sm:gap-x-6 lg:gap-x-8 gap-y-8';

  const gridCols = gridColumnClasses[columns] || gridColumnClasses[5];

  return (
    <div className={cn('grid', gridCols, gapClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton
          key={i}
          variant={variant}
          hideCategoryBadges={hideCategoryBadges}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}

export function QuoteCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Client */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Items preview */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-lg" />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function QuoteListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <QuoteCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-5 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export { StatCardSkeleton as StatsCardSkeleton };

export function ClientCardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      {/* Avatar and name */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Stats */}
      <div className="flex gap-4 border-t border-border pt-2">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}

export function OrderTimelineSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-[300px]" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <StatsGridSkeleton />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="mb-4 h-6 w-48" />
        <TableSkeleton rows={4} columns={5} />
      </div>
    </div>
  );
}

// Additional helpers that weren't in the snippet but are used in the project
export function ProductListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-border/40 bg-card px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5">
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg sm:h-[72px] sm:w-[72px]" />
      <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-3/5" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="hidden h-3 w-12 sm:block" />
        </div>
      </div>
      <div className="min-w-[80px] shrink-0 text-right sm:min-w-[100px]">
        <Skeleton className="ml-auto h-5 w-16" />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="hidden h-7 w-7 rounded-full sm:block" />
      </div>
    </div>
  );
}

export function ProductListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <ProductListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductTableSkeleton({
  rows = 10,
  className,
  selectionMode = false,
}: {
  rows?: number;
  className?: string;
  selectionMode?: boolean;
}) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm',
        className,
      )}
    >
      {/* Table Header Skeleton - Matches ProductTableView.tsx sticky header */}
      <div className="flex items-center border-b border-border/50 bg-muted/90 px-4 py-2.5">
        {selectionMode && <div className="w-10 px-2" />}
        <div className="w-12 px-2" />
        <div className="flex-1 px-3">
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="hidden w-32 px-3 md:block">
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="hidden w-40 px-3 lg:block">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="hidden w-32 px-3 sm:block">
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="w-32 px-3 text-right">
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div className="w-32 px-3 text-right">
          <Skeleton className="ml-auto h-3 w-10" />
        </div>
        <div className="w-48 px-3 text-center">
          <Skeleton className="mx-auto h-3 w-16" />
        </div>
      </div>

      {/* Table Rows - Exact height match (h-14 / 56px) */}
      <div className="divide-y divide-border/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="relative flex h-14 items-center overflow-hidden bg-card/30 px-4">
            {selectionMode && (
              <div className="flex w-10 justify-center px-2">
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            )}

            {/* Image thumb */}
            <div className="w-12 px-2">
              <Skeleton className="h-10 w-10 rounded-md" />
            </div>
            {/* Info */}
            <div className="flex-1 space-y-1.5 px-3">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-12 md:hidden" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            {/* SKU */}
            <div className="hidden w-32 px-3 md:block">
              <Skeleton className="h-3 w-20" />
            </div>
            {/* Supplier */}
            <div className="hidden w-40 px-3 lg:block">
              <Skeleton className="h-3 w-28" />
            </div>
            {/* Colors */}
            <div className="hidden w-32 gap-1 px-3 sm:flex">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-3.5 w-3.5 rounded-full" />
              ))}
            </div>
            {/* Price */}
            <div className="w-32 px-3 text-right">
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
            {/* Stock */}
            <div className="w-32 px-3 text-right">
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
            {/* Actions */}
            <div className="flex w-48 justify-center gap-2 px-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-8 w-8 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mb-6 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Left: Image & Thumbnails */}
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-20 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Right: Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-4 border-t border-border/60 pt-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="flex gap-4">
              <Skeleton className="h-14 flex-1 rounded-xl" />
              <Skeleton className="h-14 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mockup Skeletons ─────────────────────────────────────────────

export interface MockupSkeletonProps {
  variant?: 'config' | 'preview' | 'result' | 'card' | 'editor' | 'wizard';
  className?: string;
  delay?: number;
}

export function MockupSkeleton({ variant = 'config', className, delay = 0 }: MockupSkeletonProps) {
  const staggerStyle = delay > 0 ? { animationDelay: `${delay}ms` } : {};

  if (variant === 'wizard') {
    return (
      <div
        className={cn('animate-fade-in opacity-0 [animation-fill-mode:forwards]', className)}
        style={staggerStyle}
      >
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="hidden flex-1 space-y-1 md:block">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'editor') {
    return (
      <CardSkeleton className={className} style={staggerStyle}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <Skeleton className="mb-4 aspect-square rounded-xl" />
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 flex-1 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-2">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </CardSkeleton>
    );
  }

  if (variant === 'config') {
    return (
      <CardSkeleton className={className} style={staggerStyle}>
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="flex gap-2 pt-4">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </CardSkeleton>
    );
  }

  if (variant === 'preview') {
    return (
      <CardSkeleton className={className} style={staggerStyle}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded" />
        </div>
        <div className="relative mb-4">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="absolute inset-0 animate-pulse rounded-xl border-2 border-primary/20" />
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-16 rounded" />
          ))}
        </div>
      </CardSkeleton>
    );
  }

  if (variant === 'result') {
    return (
      <CardSkeleton className={className} style={staggerStyle}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <div className="relative mb-4">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-32 rounded" />
        </div>
      </CardSkeleton>
    );
  }

  return (
    <div
      className={cn(
        'animate-fade-in overflow-hidden rounded-xl border bg-card opacity-0 [animation-fill-mode:forwards]',
        className,
      )}
      style={staggerStyle}
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function CardSkeleton({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        'animate-fade-in overflow-hidden rounded-xl border border-border bg-card p-4 opacity-0 [animation-fill-mode:forwards] sm:p-6',
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function MockupHistorySkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <MockupSkeleton key={i} variant="card" delay={i * 50} />
      ))}
    </div>
  );
}

export function MockupPageSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <MockupSkeleton variant="wizard" delay={0} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <MockupSkeleton variant="config" delay={100} />
        </div>
        <div className="lg:col-span-4">
          <MockupSkeleton variant="editor" delay={200} />
        </div>
        <div className="lg:col-span-4">
          <MockupSkeleton variant="result" delay={300} />
        </div>
      </div>
    </div>
  );
}
