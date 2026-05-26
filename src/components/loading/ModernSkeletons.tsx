import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCardSkeletonProps {
  variant?: "default" | "compact" | "detailed" | "list";
  className?: string;
  id?: string;
}

/**
 * Standardized Product Card Skeleton with variants.
 */
export function ProductCardSkeleton({ variant = "default", className, id }: ProductCardSkeletonProps) {
  const skeletonId = id || `product-card-${variant}`;
  
  if (variant === "compact" || variant === "list") {
    return (
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40 overflow-hidden", 
          variant === "list" && "px-4 py-2.5",
          className
        )}
        data-skeleton-container={skeletonId}
      >
        <Skeleton 
          className={cn(
            "rounded-lg shrink-0", 
            variant === "compact" ? "h-16 w-16" : "w-14 h-14 sm:w-[72px] sm:h-[72px]"
          )} 
          id={`${skeletonId}-image`} 
        />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-1.5">
             <Skeleton className="h-3 w-16" id={`${skeletonId}-badge`} />
             <Skeleton className="h-3 w-12" id={`${skeletonId}-sku`} />
          </div>
          <Skeleton className="h-4 w-3/4" id={`${skeletonId}-title`} />
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-16" id={`${skeletonId}-price`} />
            <div className="flex gap-1">
               <Skeleton className="h-7 w-7 rounded-full" id={`${skeletonId}-action-1`} />
               <Skeleton className="h-7 w-7 rounded-full" id={`${skeletonId}-action-2`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden h-full", className)}
      data-skeleton-container={skeletonId}
    >
      {/* Image */}
      <Skeleton className="aspect-square w-full rounded-none" id={`${skeletonId}-image`} />
      
      {/* Content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Category badge */}
        <Skeleton className="h-5 w-20 rounded-full" id={`${skeletonId}-badge`} />
        
        {/* Title */}
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-full" id={`${skeletonId}-title-1`} />
          <Skeleton className="h-5 w-3/4" id={`${skeletonId}-title-2`} />
        </div>
        
        {/* SKU */}
        <Skeleton className="h-4 w-24" id={`${skeletonId}-sku`} />
        
        <div className="flex-1" />

        {/* Price + Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <Skeleton className="h-6 w-20" id={`${skeletonId}-price`} />
          <div className="flex gap-1.5">
            {variant === "detailed" && (
              <Skeleton className="h-8 w-8 rounded-full" id={`${skeletonId}-action-ext`} />
            )}
            <Skeleton className="h-8 w-8 rounded-full" id={`${skeletonId}-action`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Grid or List of products skeleton.
 */
export function ProductGridSkeleton({ 
  count = 12, 
  variant = "default",
  columns = 5,
  id = "product-grid",
  className
}: { 
  count?: number; 
  variant?: "default" | "compact" | "detailed" | "list";
  columns?: number;
  id?: string;
  className?: string;
}) {
  const isList = variant === "list" || variant === "compact";
  const gridCols = isList 
    ? "grid-cols-1" 
    : columns === 5 
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
      : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(columns, 4)} xl:grid-cols-${columns}`;

  return (
    <div className={cn("grid gap-4 md:gap-6", gridCols, className)} data-skeleton-grid={id}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} variant={variant === "list" ? "list" : variant} id={`${id}-item-${i}`} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5, id = "table" }: { rows?: number; columns?: number; id?: string }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card" data-skeleton-table={id}>
      <table className="w-full border-collapse">
        <thead className="bg-muted/30">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="py-3 px-4 text-left border-b border-border">
                <Skeleton className="h-4 w-20" id={`${id}-header-${i}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/50 last:border-0">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="py-4 px-4">
                  <Skeleton className="h-5 w-full max-w-[120px]" id={`${id}-cell-${rowIndex}-${colIndex}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatsGridSkeleton({ count = 4, id = "stats" }: { count?: number; id?: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-skeleton-stats={id}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" id={`${id}-label-${i}`} />
            <Skeleton className="h-8 w-8 rounded-lg" id={`${id}-icon-${i}`} />
          </div>
          <Skeleton className="h-8 w-20" id={`${id}-value-${i}`} />
          <Skeleton className="h-3 w-32" id={`${id}-sub-${i}`} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ id = "chart", className }: { id?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", className)} data-skeleton-chart={id}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" id={`${id}-title`} />
        <Skeleton className="h-8 w-24 rounded-md" id={`${id}-filter`} />
      </div>
      <div className="flex items-end gap-2 h-48 pt-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            id={`${id}-bar-${i}`}
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between border-t border-border/30 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" id={`${id}-label-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-skeleton-page="dashboard">
      <StatsGridSkeleton id="dash-stats" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton id="dash-chart-1" />
        <ChartSkeleton id="dash-chart-2" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-48 mb-4" id="dash-activity-title" />
        <TableSkeleton rows={4} columns={5} id="dash-activity-table" />
      </div>
    </div>
  );
}

export function PageHeaderSkeleton({ id = "page-header" }: { id?: string }) {
  return (
    <div className="space-y-4 mb-6" data-skeleton-header={id}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" id={`${id}-title`} />
          <Skeleton className="h-4 w-64 rounded-md" id={`${id}-subtitle`} />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" id={`${id}-btn-1`} />
          <Skeleton className="h-10 w-10 rounded-md" id={`${id}-btn-2`} />
        </div>
      </div>
    </div>
  );
}

export { StatsGridSkeleton as StatsCardSkeleton };
export { TableSkeleton as TableRowSkeleton };
