/**
 * CartItemSkeleton - Skeleton loader for cart items
 */
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CartItemSkeleton() {
  return (
    <Card className="group animate-pulse overflow-hidden border-border/40 shadow-sm">
      <div className="relative aspect-square w-full bg-muted/10">
        <Skeleton className="absolute inset-0 rounded-none opacity-20" />
        {/* Quick actions placeholders */}
        <div className="absolute left-2 top-2 h-7 w-7 rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm" />
        <div className="absolute right-2 top-2 h-7 w-7 rounded-lg border border-white/10 bg-card/40 backdrop-blur-sm" />
        {/* Center icon placeholder */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>
      <div className="space-y-4 p-3.5">
        <div className="flex flex-col gap-1.5">
          {/* SKU skeleton */}
          <Skeleton className="h-3 w-16 rounded-sm opacity-40" />

          {/* Name skeleton */}
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-full opacity-30" />
            <Skeleton className="h-3.5 w-2/3 opacity-20" />
          </div>
        </div>

        {/* Unit Price skeleton using standardized layout */}
        <div className="flex flex-col space-y-2 pt-0.5">
          <Skeleton className="h-2.5 w-12 opacity-50" />
          <Skeleton className="h-4.5 w-24 opacity-30" />
        </div>

        {/* Footer/Stepper skeleton */}
        <div className="flex items-center justify-between border-t border-border/10 pt-3.5">
          <Skeleton className="h-8 w-24 rounded-lg opacity-30" />
          <div className="flex flex-col items-end space-y-2">
            <Skeleton className="h-2.5 w-14 opacity-50" />
            <Skeleton className="h-4.5 w-20 opacity-30" />
          </div>
        </div>

        {/* Notes trigger skeleton */}
        <div className="flex items-center gap-1.5 pt-0.5 opacity-40">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="ml-auto h-3 w-3 rounded-full" />
        </div>
      </div>
    </Card>
  );
}
