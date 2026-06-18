/**
 * ReplenishmentCardSkeleton — Skeleton dedicado com o shape exato do
 * ReplenishmentGridCard (430px, badge top-left, imagem 1:1, meta line,
 * nome, preço+estoque, categoria, swatches, sparkline).
 *
 * Por que dedicado: o ProductCardSkeleton genérico tem proporções
 * diferentes e causa "layout shift" perceptível na entrada do grid.
 */
import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { productCardStyles } from '@/components/products/product-card-styles';

export interface ReplenishmentCardSkeletonProps {
  readonly className?: string;
}

export const ReplenishmentCardSkeleton = memo(function ReplenishmentCardSkeleton({
  className,
}: ReplenishmentCardSkeletonProps) {
  return (
    <Card
      className={cn(
        productCardStyles.container,
        'h-[430px] max-h-[430px] min-h-[430px] cursor-default',
        className,
      )}
      aria-hidden="true"
      aria-busy="true"
    >
      <CardContent className="flex h-full flex-col p-0">
        {/* Image area (aspect-square) com badge fantasma */}
        <div className="relative aspect-square overflow-hidden bg-muted/40">
          <Skeleton className="h-full w-full rounded-none" />
          <div className="absolute left-2 top-2">
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>

        {/* Content */}
        <div className={cn(productCardStyles.infoSection, 'flex flex-1 flex-col')}>
          {/* Meta: SKU + Fornecedor */}
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>

          {/* Nome (2 linhas) */}
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>

          {/* Preço + Estoque */}
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

          {/* Categoria chip */}
          <div className={productCardStyles.categoryBadgeSection}>
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>

          {/* Swatches */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-4 rounded-full" />
            ))}
          </div>

          {/* Sparkline */}
          <div className={productCardStyles.sparklineSection}>
            <Skeleton className="mb-1 h-2 w-20" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
