import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface ProductCardSkeletonProps {
  variant?: "default" | "compact" | "detailed";
  className?: string;
  animate?: boolean;
  hideCategoryBadges?: boolean;
}

export function ProductCardSkeleton({ 
  variant = "default", 
  className, 
  animate = true,
  hideCategoryBadges = false 
}: ProductCardSkeletonProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40 overflow-hidden", className)}>
        <Skeleton className="h-16 w-16 rounded-lg shrink-0" animate={animate} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" animate={animate} />
          <Skeleton className="h-3 w-1/2" animate={animate} />
          <Skeleton className="h-4 w-16" animate={animate} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group relative flex flex-col rounded-xl sm:rounded-2xl border border-border bg-card overflow-hidden h-full", className)}>
      {/* Image Section - Matches ProductCardImage aspect ratio */}
      <Skeleton className="aspect-square w-full rounded-none" animate={animate} />
      
      {/* Info Section - Synchronized with ProductCard.tsx */}
      <div className="relative space-y-2.5 p-3 sm:space-y-4 sm:p-5 flex-1 flex flex-col">
        {/* Category badge */}
        {!hideCategoryBadges && (
          <Skeleton className="h-5 w-20 rounded-full" animate={animate} />
        )}
        
        {/* SKU & Meta Row */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-16" animate={animate} />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-8 rounded-md" animate={animate} />
            <Skeleton className="h-5 w-24 rounded-lg" animate={animate} />
          </div>
        </div>
        
        {/* Title - Fixed min-height to prevent layout shift */}
        <div className="min-h-[2.25rem] sm:min-h-[2.75rem] space-y-1.5">
          <Skeleton className="h-5 w-full" animate={animate} />
          <Skeleton className="h-5 w-2/3" animate={animate} />
        </div>
        
        {/* Footer: Price & Actions */}
        <div className="flex items-center justify-between pt-2 mt-auto">
          <div className="space-y-1">
            <Skeleton className="h-6 w-24" animate={animate} />
            <Skeleton className="h-3 w-16" animate={animate} />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" animate={animate} />
        </div>
      </div>
    </div>
  );
}

const gridColumnClasses: Record<number, string> = {
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  8: "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
};

export function ProductGridSkeleton({ 
  count = 15, 
  variant = "default",
  columns = 5,
  className,
  hideCategoryBadges = false
}: { 
  count?: number; 
  variant?: "default" | "compact" | "detailed";
  columns?: number;
  className?: string;
  hideCategoryBadges?: boolean;
}) {
  // Use the exact same gap logic as ProductGrid.tsx for layout stability
  const gapClass = columns >= 8 
    ? "gap-x-4 gap-y-8" 
    : columns >= 6 
    ? "gap-x-6 gap-y-8" 
    : "gap-x-4 sm:gap-x-6 lg:gap-x-8 gap-y-8";

  const gridCols = gridColumnClasses[columns] || gridColumnClasses[5];

  return (
    <div className={cn("grid", gridCols, gapClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} variant={variant} hideCategoryBadges={hideCategoryBadges} />
      ))}
    </div>
  );
}

export function QuoteCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
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
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function QuoteListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <td key={i} className="py-4 px-4">
          <Skeleton className="h-5 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="py-3 px-4 text-left">
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
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export { StatCardSkeleton as StatsCardSkeleton };

export function ClientCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
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
      <div className="flex gap-4 pt-2 border-t border-border">
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
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
      
      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-48 mb-4" />
        <TableSkeleton rows={4} columns={5} />
      </div>
    </div>
  );
}

// Additional helpers that weren't in the snippet but are used in the project
export function ProductListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-card border border-border/40 overflow-hidden">
      <Skeleton className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 py-0.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-3/5" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12 hidden sm:block" />
        </div>
      </div>
      <div className="shrink-0 text-right min-w-[80px] sm:min-w-[100px]">
        <Skeleton className="h-5 w-16 ml-auto" />
      </div>
      <div className="shrink-0 flex items-center gap-0.5">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-full hidden sm:block" />
      </div>
    </div>
  );
}

export function ProductListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(count)].map((_, i) => (
        <ProductListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductTableSkeleton({ rows = 10, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("w-full border border-border/40 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm", className)}>
      {/* Table Header Skeleton - Matches ProductTableView.tsx sticky header */}
      <div className="flex items-center px-4 py-2.5 bg-muted/90 border-b border-border/50">
        <div className="w-12 px-2"><Skeleton className="h-4 w-4" /></div>
        <div className="flex-1 px-3"><Skeleton className="h-3 w-20" /></div>
        <div className="w-32 px-3 hidden md:block"><Skeleton className="h-3 w-12" /></div>
        <div className="w-40 px-3 hidden lg:block"><Skeleton className="h-3 w-24" /></div>
        <div className="w-32 px-3 hidden sm:block"><Skeleton className="h-3 w-16" /></div>
        <div className="w-32 px-3 text-right"><Skeleton className="h-3 w-12 ml-auto" /></div>
        <div className="w-32 px-3 text-right"><Skeleton className="h-3 w-10 ml-auto" /></div>
        <div className="w-48 px-3 text-center"><Skeleton className="h-3 w-16 mx-auto" /></div>
      </div>
      
      {/* Table Rows - Exact height match (h-14 / 56px) */}
      <div className="divide-y divide-border/20">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center px-4 h-14 relative overflow-hidden bg-card/30">
            {/* Image thumb */}
            <div className="w-12 px-2">
              <Skeleton className="w-10 h-10 rounded-md" />
            </div>
            {/* Info */}
            <div className="flex-1 px-3 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                 <Skeleton className="h-3 w-12 md:hidden" />
                 <Skeleton className="h-3 w-24" />
              </div>
            </div>
            {/* SKU */}
            <div className="w-32 px-3 hidden md:block">
              <Skeleton className="h-3 w-20" />
            </div>
            {/* Supplier */}
            <div className="w-40 px-3 hidden lg:block">
              <Skeleton className="h-3 w-28" />
            </div>
            {/* Colors */}
            <div className="w-32 px-3 hidden sm:flex gap-1">
              {[1, 2, 3].map(j => (
                <Skeleton key={j} className="w-3.5 h-3.5 rounded-full" />
              ))}
            </div>
            {/* Price */}
            <div className="w-32 px-3 text-right">
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
            {/* Stock */}
            <div className="w-32 px-3 text-right">
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
            {/* Actions */}
            <div className="w-48 px-3 flex justify-center gap-2">
              {[1, 2, 3].map(j => (
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
    <div className={cn("space-y-4 mb-6", className)}>
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
    <div className="mx-auto w-full max-w-[1920px] space-y-8 animate-fade-in">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
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
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-4 pt-4 border-t border-border/60">
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
