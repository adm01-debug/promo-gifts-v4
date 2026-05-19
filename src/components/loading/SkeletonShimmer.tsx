import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * SkeletonShimmer — Coleção de skeletons unificados e performáticos.
 * Utiliza as animações SSOT definidas em animations.css.
 */

interface SkeletonBaseProps {
  className?: string;
  children?: ReactNode;
}

export function SkeletonShimmer({ className, children }: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0",
        "before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({ className }: SkeletonBaseProps) {
  return (
    <div className={cn("space-y-4", className)} aria-label="Carregando cabeçalho...">
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

interface TextSkeletonProps extends SkeletonBaseProps {
  lines?: number;
  lastLineWidth?: string;
}

export function TextSkeleton({ 
  lines = 3, 
  className,
  lastLineWidth = "60%" 
}: TextSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} aria-label="Carregando texto...">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? `w-[${lastLineWidth}]` : "w-full"
          )}
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 5,
  showHeader = true,
  className 
}: { 
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div 
      className={cn("rounded-lg border bg-card overflow-hidden", className)}
      aria-label="Carregando tabela..."
    >
      {showHeader && (
        <div className="flex items-center gap-4 py-3 px-4 bg-muted/50 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "h-4",
                i === 0 ? "w-8" : "flex-1"
              )}
            />
          ))}
        </div>
      )}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 px-4">
             {Array.from({ length: columns }).map((_, j) => (
               <Skeleton key={j} className={cn("h-4", j === 0 ? "w-8" : "flex-1")} />
             ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-xl border bg-card p-6 space-y-4",
        className
      )}
      aria-label="Carregando estatística..."
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-xl border bg-card p-6 space-y-4",
        className
      )}
      aria-label="Carregando gráfico..."
    >
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
