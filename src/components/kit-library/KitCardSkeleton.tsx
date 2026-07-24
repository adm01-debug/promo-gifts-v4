/**
 * Skeleton para KitCard — usado durante carregamento da biblioteca.
 */
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function KitCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-1.5 w-full rounded-none" />
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <div className="flex items-end justify-between border-t border-border/40 pt-2">
          <div className="space-y-1.5">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KitCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <KitCardSkeleton key={i} />
      ))}
    </div>
  );
}
