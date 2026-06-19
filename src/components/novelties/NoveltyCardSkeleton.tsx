/**
 * NoveltyCardSkeleton — Skeleton dedicado com shape exato do
 * NoveltyGridCard (min-h-[420px], badge top-left, imagem 1:1, meta line,
 * nome, preço+estoque, categoria, swatches).
 *
 * Espelha `ReplenishmentCardSkeleton` (sem o bloco "Saídas 90d") para
 * garantir paridade visual entre os dois grids durante o loading e
 * evitar layout shift na troca skeleton→card real.
 */
import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { productCardStyles } from '@/components/products/product-card-styles';

export interface NoveltyCardSkeletonProps {
  readonly className?: string;
}

export const NoveltyCardSkeleton = memo(function NoveltyCardSkeleton({
  className,
}: NoveltyCardSkeletonProps) {
  return (
    <Card
      className={cn(
        productCardStyles.container,
        'h-[420px] max-h-[420px] min-h-[420px] cursor-default',
        className,
      )}
      aria-hidden="true"
      aria-busy="true"
      data-testid="novelty-loading-card"
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="relative aspect-square overflow-hidden bg-muted/40">
          <Skeleton className="h-full w-full rounded-none" />
          <div className="absolute left-2 top-2">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>

        <div className={cn(productCardStyles.infoSection, 'flex flex-1 flex-col')}>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>

          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>

          <div className={productCardStyles.priceStockSection}>
            <div className={cn(productCardStyles.priceContainer, 'space-y-1')}>
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          </div>

          <div className={productCardStyles.categoryBadgeSection}>
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
