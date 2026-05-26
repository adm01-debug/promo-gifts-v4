import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCardSkeletonProps {
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export function ProductCardSkeleton({ variant = "default", className }: ProductCardSkeletonProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40 overflow-hidden", className)}>
        <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Image */}
      <Skeleton className="aspect-square w-full rounded-none" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Category badge */}
        <Skeleton className="h-5 w-20 rounded-full" />
        
        {/* Title */}
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        
        {/* SKU */}
        <Skeleton className="h-4 w-24" />
        
        {/* Price */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20" />
          {variant === "detailed" ? (
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : (
            <Skeleton className="h-8 w-8 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ 
  count = 12, 
  variant = "default",
  columns = 5 
}: { 
  count?: number; 
  variant?: "default" | "compact" | "detailed";
  columns?: number;
}) {
  const gridCols = columns === 5 
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(columns, 4)} xl:grid-cols-${columns}`;

  return (
    <div className={cn("grid gap-6", gridCols)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

export function ProductCardInlineSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/40 overflow-hidden">
      <Skeleton className="h-16 w-16 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

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

export function ProductTableSkeleton({ rows = 10, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("w-full border border-border/40 rounded-xl overflow-hidden bg-card", className)}>
      <div className="flex items-center px-4 py-2.5 bg-muted/40 border-b border-border/50">
        <div className="w-12 px-2"><Skeleton className="h-4 w-4" /></div>
        <div className="flex-1 px-3"><Skeleton className="h-3 w-16" /></div>
        <div className="w-32 px-3 hidden md:block"><Skeleton className="h-3 w-12" /></div>
        <div className="w-40 px-3 hidden lg:block"><Skeleton className="h-3 w-20" /></div>
        <div className="w-32 px-3 hidden sm:block"><Skeleton className="h-3 w-12" /></div>
        <div className="w-32 px-3 text-right"><Skeleton className="h-3 w-12 ml-auto" /></div>
        <div className="w-32 px-3 text-right"><Skeleton className="h-3 w-10 ml-auto" /></div>
        <div className="w-48 px-3"><Skeleton className="h-3 w-16 mx-auto" /></div>
      </div>
      <div className="divide-y divide-border/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center px-4 h-14 relative overflow-hidden">
            <div className="w-12 px-2">
              <Skeleton className="w-10 h-10 rounded-md" />
            </div>
            <div className="flex-1 px-3 space-y-2">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                 <Skeleton className="h-3 w-16 md:hidden" />
                 <Skeleton className="h-3 w-12" />
              </div>
            </div>
            <div className="w-32 px-3 hidden md:block">
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="w-40 px-3 hidden lg:block">
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="w-32 px-3 hidden sm:flex gap-1">
              {[1, 2, 3].map(j => (
                <Skeleton key={j} className="w-3.5 h-3.5 rounded-full" />
              ))}
            </div>
            <div className="w-32 px-3 text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
            <div className="w-32 px-3 text-right">
              <Skeleton className="h-4 w-12 ml-auto" />
            </div>
            <div className="w-48 px-3 flex justify-center gap-2">
              {[1, 2, 3, 4].map(j => (
                <Skeleton key={j} className="w-8 h-8 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
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

export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-2/3" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

export function ClientCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <Skeleton className="h-11 w-11 rounded-full shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function OrderTimelineSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-3 w-3 rounded-full" />
            <div className="w-0.5 flex-1 bg-border/40 my-1" />
          </div>
          <div className="flex-1 pb-6 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
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
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      
      {/* Recent activity */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-48 mb-4" />
        <TableSkeleton rows={4} columns={5} />
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
