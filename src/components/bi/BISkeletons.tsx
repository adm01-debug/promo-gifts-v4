/**
 * BISkeletons — esqueletos com a forma das zonas reais do BI.
 * Reduz CLS percebido e dá pista visual de "o que vem aí".
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function HeroSkeleton() {
  return (
    <Card className="overflow-hidden border-[1.5px]">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="border-[1.5px]">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ProductGridSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg p-2.5">
            <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4 max-w-xs" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function HeatmapSkeleton() {
  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-3 w-80" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[80px_repeat(12,1fr)] gap-1">
          <div />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-3 w-full" />
          ))}
          <Skeleton className="h-4 w-16" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={`c-${i}`} className="h-12 w-full rounded-md" />
          ))}
          <Skeleton className="h-4 w-16" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={`s-${i}`} className="h-12 w-full rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 md:grid-cols-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparisonSkeleton() {
  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-72" />
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2 w-3/4 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
