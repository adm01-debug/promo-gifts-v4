/**
 * NoveltyCards — Grid, List, Table, and Skeleton card components for novelties.
 * Follows the same info pattern as ProductCard (catalog).
 */
import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2, FolderTree, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { NoveltyBadge } from '@/components/products/NoveltyBadge';
import { ProductSparkline } from '@/components/products/ProductSparkline';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { cn } from '@/lib/utils';
import type { NoveltyWithDetails } from '@/hooks/products';

function isFresh(detectedAt: string): boolean {
  return Math.floor((Date.now() - new Date(detectedAt).getTime()) / 86400000) <= 2;
}

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStockStatusColor(status: string) {
  switch (status) {
    case 'in-stock':
      return 'in-stock';
    case 'low-stock':
      return 'low-stock';
    case 'out-of-stock':
      return 'out-of-stock';
    default:
      return 'in-stock';
  }
}

function getStockStatusLabel(status: string) {
  switch (status) {
    case 'in-stock':
      return 'Em estoque';
    case 'low-stock':
      return 'Estoque baixo';
    case 'out-of-stock':
      return 'Sem estoque';
    default:
      return 'Em estoque';
  }
}

export interface NoveltyCardProps {
  product: NoveltyWithDetails;
  onClick: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export const NoveltyGridCard = memo(function NoveltyGridCard({
  product,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelect,
}: NoveltyCardProps) {
  const fresh = isFresh(product.detected_at);
  const stockQty = product.stock_quantity ?? 0;
  const stockStatus = product.stock_status ?? 'in-stock';
  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 sm:rounded-2xl',
        'border-border/50 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
        fresh && 'border-success/30 shadow-[0_0_16px_hsl(var(--success)/0.1)]',
        isSelected &&
          'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-2 ring-primary',
      )}
      onClick={selectionMode ? onToggleSelect : onClick}
    >
      <CardContent className="p-0">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
          {product.product_image ? (
            <img
              src={product.product_image}
              alt={product.product_name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}
          {selectionMode && (
            <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
              <SelectionCheckbox
                checked={isSelected}
                onChange={onToggleSelect}
                size="md"
                animateEntry
              />
            </div>
          )}
          <div className="absolute left-2 top-2">
            <NoveltyBadge daysRemaining={product.days_remaining} size="sm" />
          </div>
          {fresh && !selectionMode && (
            <div className="absolute right-2 top-2">
              <Badge className="gap-0.5 border-0 bg-success/90 px-1.5 py-0 text-[9px] text-success-foreground">
                <Sparkles className="h-2.5 w-2.5" />
                NEW
              </Badge>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        {/* Info section — matching catalog ProductCard */}
        <div className="relative space-y-2 bg-card p-2.5 sm:space-y-3 sm:p-4">
          {/* SKU + Supplier */}
          <div className="flex items-center justify-between gap-2">
            {product.product_sku && (
              <span className="truncate font-mono text-[10px] text-muted-foreground sm:text-xs">
                {product.product_sku}
              </span>
            )}
            {product.supplier_name && (
              <span className="flex max-w-[120px] shrink-0 items-center gap-1 truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground sm:px-2 sm:text-xs">
                <Building2 className="h-3 w-3 shrink-0" />
                {product.supplier_name}
              </span>
            )}
          </div>

          {/* Product name */}
          <h3 className="line-clamp-2 min-h-[2.25rem] font-display text-sm font-semibold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:min-h-[2.75rem] sm:text-base">
            {product.product_name}
          </h3>

          {/* Price + Stock */}
          <div className="flex items-end justify-between pt-0.5 sm:pt-1">
            <div>
              {product.base_price !== null && product.base_price > 0 ? (
                <>
                  <p className="mb-0.5 text-[10px] text-muted-foreground sm:text-xs">A partir de</p>
                  <span className="font-display text-base font-bold text-foreground sm:text-xl">
                    {formatPrice(product.base_price)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Preço sob consulta</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 sm:gap-1">
              <span
                className={cn(
                  'stock-indicator text-[10px] sm:text-xs',
                  getStockStatusColor(stockStatus),
                )}
              >
                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">{getStockStatusLabel(stockStatus)}</span>
                <span className="sm:hidden">
                  {stockStatus === 'in-stock' ? '✓' : stockStatus === 'low-stock' ? '!' : '✗'}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground sm:text-xs">
                {stockQty.toLocaleString('pt-BR')} un.
              </span>
            </div>
          </div>

          {/* Category badge */}
          {product.category_name && (
            <div className="mt-0.5 flex flex-wrap gap-1.5 border-t border-primary/20 pt-1.5">
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm shadow-primary/10 sm:text-xs">
                <FolderTree className="h-2.5 w-2.5" aria-hidden="true" />
                {product.category_name}
              </span>
            </div>
          )}

          {/* Vendas 30d sparkline */}
          <div className="border-t border-border/30 pt-1.5 sm:pt-2">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                Vendas 30d
              </span>
            </div>
            <ProductSparkline productId={product.product_id} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export const NoveltyListCard = memo(function NoveltyListCard({
  product,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelect,
}: NoveltyCardProps) {
  const fresh = isFresh(product.detected_at);
  const stockQty = product.stock_quantity ?? 0;
  const stockStatus = product.stock_status ?? 'in-stock';
  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md',
        fresh && 'border-success/30 shadow-[0_0_12px_hsl(var(--success)/0.08)]',
        isSelected &&
          'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-2 ring-primary',
      )}
      onClick={selectionMode ? onToggleSelect : onClick}
    >
      <CardContent className="flex items-center gap-2.5 p-2.5">
        {selectionMode && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <SelectionCheckbox
              checked={isSelected}
              onChange={onToggleSelect}
              size="md"
              animateEntry
            />
          </div>
        )}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-14 sm:w-14">
          {product.product_image ? (
            <img
              src={product.product_image}
              alt={product.product_name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
          {fresh && <div className="absolute inset-0 rounded-lg ring-2 ring-success/40" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <NoveltyBadge daysRemaining={product.days_remaining} size="sm" />
            {fresh && (
              <Badge className="border-0 bg-success/90 px-1 py-0 text-[9px] text-success-foreground">
                NEW
              </Badge>
            )}
          </div>
          <h4 className="line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
            {product.product_name}
          </h4>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {product.product_sku && (
              <p className="text-[10px] text-muted-foreground">SKU: {product.product_sku}</p>
            )}
            {product.supplier_name && (
              <Badge variant="outline" className="border-info/30 px-1 py-0 text-[9px] text-info">
                <Building2 className="mr-0.5 h-2.5 w-2.5" />
                {product.supplier_name}
              </Badge>
            )}
            {product.category_name && (
              <Badge variant="outline" className="px-1 py-0 text-[9px]">
                <FolderTree className="mr-0.5 h-2.5 w-2.5" />
                {product.category_name}
              </Badge>
            )}
            <span className={cn('stock-indicator text-[9px]', getStockStatusColor(stockStatus))}>
              <Package className="h-2.5 w-2.5" />
              {getStockStatusLabel(stockStatus)}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {stockQty.toLocaleString('pt-BR')} un.
            </span>
          </div>
        </div>
        {product.base_price !== null && product.base_price > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-muted-foreground">A partir de</p>
            <p className="text-sm font-semibold tabular-nums">{formatPrice(product.base_price)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export function NoveltyTableView({
  products,
  onProductClick,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: {
  products: NoveltyWithDetails[];
  onProductClick: (id: string) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {selectionMode && <TableHead className="w-[40px] px-2"></TableHead>}
            <TableHead className="w-[44px] px-2">Img</TableHead>
            <TableHead className="px-2">Produto</TableHead>
            <TableHead className="hidden px-2 sm:table-cell">SKU</TableHead>
            <TableHead className="hidden px-2 md:table-cell">Fornecedor</TableHead>
            <TableHead className="hidden px-2 lg:table-cell">Categoria</TableHead>
            <TableHead className="px-2 text-center">Status</TableHead>
            <TableHead className="px-2 text-center">Estoque</TableHead>
            <TableHead className="px-2 text-right">Preço</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const fresh = isFresh(product.detected_at);
            const isSelected = selectedIds.has(product.product_id);
            const stockQty = product.stock_quantity ?? 0;
            const stockStatus = product.stock_status ?? 'in-stock';
            return (
              <TableRow
                key={product.novelty_id}
                className={cn(
                  'cursor-pointer transition-colors',
                  fresh && 'bg-success/5',
                  isSelected && 'bg-primary/10',
                )}
                onClick={() =>
                  selectionMode
                    ? onToggleSelect(product.product_id)
                    : onProductClick(product.product_id)
                }
              >
                {selectionMode && (
                  <TableCell className="p-1.5">
                    <div onClick={(e) => e.stopPropagation()}>
                      <SelectionCheckbox
                        checked={isSelected}
                        onChange={() => onToggleSelect(product.product_id)}
                        size="sm"
                      />
                    </div>
                  </TableCell>
                )}
                <TableCell className="p-1.5">
                  <div className="h-9 w-9 overflow-hidden rounded bg-muted">
                    {product.product_image ? (
                      <img
                        src={product.product_image}
                        alt={product.product_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-3.5 w-3.5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <p className="line-clamp-1 text-xs font-medium">{product.product_name}</p>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 sm:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.product_sku || '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 md:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.supplier_name || '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 lg:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.category_name || '—'}
                  </span>
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <NoveltyBadge daysRemaining={product.days_remaining} size="sm" />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <span
                    className={cn('stock-indicator text-[10px]', getStockStatusColor(stockStatus))}
                  >
                    <Package className="h-2.5 w-2.5" />
                    {getStockStatusLabel(stockStatus)}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {stockQty.toLocaleString('pt-BR')} un.
                  </p>
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right">
                  {product.base_price !== null && product.base_price > 0 ? (
                    <span className="text-xs font-semibold tabular-nums">
                      {formatPrice(product.base_price)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

type ViewMode = 'grid' | 'list' | 'table';

export function NoveltyCardSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'list') {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center gap-2.5 p-2.5">
          <Skeleton className="h-12 w-12 rounded-lg sm:h-14 sm:w-14" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }
  if (viewMode === 'table') {
    return (
      <div className="flex items-center gap-2 border-b border-border/30 px-2 py-1.5">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-14" />
      </div>
    );
  }
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-0">
        <Skeleton className="aspect-square" />
        <div className="space-y-1.5 p-2.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
