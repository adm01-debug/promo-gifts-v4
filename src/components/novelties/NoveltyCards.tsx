/**
 * NoveltyCards — Grid, List, Table, and Skeleton card components for novelties.
 * Follows the same info pattern as ProductCard (catalog).
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2, FolderTree } from 'lucide-react';
import { StockBadge, getStockStatus } from '@/components/inventory/StockBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { NoveltyBadge } from '@/components/products/NoveltyBadge';
import { ProductStatusBadge } from '@/components/products/ProductStatusBadge';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';

interface NoveltyCardProps {
  product: NoveltyWithDetails;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onStatusClick?: (type: string) => void;
  colors?: readonly ColorDotLike[];
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function NoveltyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function NoveltyListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Skeleton className="h-16 w-16 flex-shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grid Card ────────────────────────────────────────────────────────────────
export const NoveltyGridCard = memo(function NoveltyGridCard({
  product,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onStatusClick,
  colors,
}: NoveltyCardProps) {
  const fresh = product.days_remaining >= 25;

  return (
    <article
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3 transition-all',
        'hover:border-primary/40 hover:shadow-md',
        'h-[420px] max-h-[420px] min-h-[420px]', // Altura fixa para paridade no grid
        isSelected && 'border-primary ring-2 ring-primary/20',
      )}
      onClick={() => onSelect?.(product.product_id)}
    >
      {/* Selection indicator */}
      {selectionMode && (
        <div
          className={cn(
            'absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground bg-card',
          )}
        >
          {isSelected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/20">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={product.product_name}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <NoveltyBadge
            daysRemaining={product.days_remaining}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onStatusClick?.('novelty');
            }}
          />
        </div>
        {fresh && !selectionMode && (
          <div className="absolute right-2 top-2">
            <ProductStatusBadge
              type="novelty"
              value="NEW"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStatusClick?.('novelty');
              }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-sm font-medium leading-tight">
          {product.product_name ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground">{product.product_sku ?? '—'}</p>

        {/* Categoria + Fornecedor */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {product.category_name && (
            <span className="flex items-center gap-0.5 truncate" title={product.category_name}>
              <FolderTree className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{product.category_name}</span>
            </span>
          )}
          {product.supplier_name && (
            <span className="flex items-center gap-0.5 truncate" title={product.supplier_name}>
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{product.supplier_name}</span>
            </span>
          )}
        </div>

        <div className="mt-0.5">
          <ProductColorSwatches colors={colors} max={5} size="sm" hideWhenEmpty={false} />
        </div>

        {/* Preço + Estoque */}
        <div className="flex items-center justify-between gap-2">
          {product.base_price !== null && (
            <p className="text-sm font-semibold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                product.base_price,
              )}
            </p>
          )}
          <StockBadge
            status={
              product.stock_status ?? getStockStatus(product.stock_quantity ?? 0, 10)
            }
            quantity={product.stock_quantity ?? 0}
            showQuantity
            size="sm"
          />
        </div>
      </div>
    </article>
  );
});

// ── List Card ────────────────────────────────────────────────────────────────
export const NoveltyListCard = memo(function NoveltyListCard({
  product,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onStatusClick,
  colors,
}: NoveltyCardProps) {
  const fresh = product.days_remaining >= 25;

  return (
    <article
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-all',
        'hover:border-primary/40 hover:shadow-sm',
        isSelected && 'border-primary ring-2 ring-primary/20',
      )}
      onClick={() => onSelect?.(product.product_id)}
    >
      {selectionMode && (
        <div
          className={cn(
            'absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground bg-card',
          )}
        >
          {isSelected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted/20">
        {product.product_image ? (
          <img
            src={product.product_image}
            alt={product.product_name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <NoveltyBadge
            daysRemaining={product.days_remaining}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onStatusClick?.('novelty');
            }}
          />
          {fresh && (
            <ProductStatusBadge
              type="novelty"
              value="NEW"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStatusClick?.('novelty');
              }}
            />
          )}
        </div>
        <p className="truncate text-sm font-medium">{product.product_name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{product.product_sku ?? '—'}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {product.category_name && (
            <span className="flex items-center gap-0.5">
              <FolderTree className="h-3 w-3" />
              {product.category_name}
            </span>
          )}
          {product.supplier_name && (
            <span className="flex items-center gap-0.5">
              <Building2 className="h-3 w-3" />
              {product.supplier_name}
            </span>
          )}
          <ProductColorSwatches colors={colors} max={5} size="xs" hideWhenEmpty={false} />
        </div>
      </div>

      {/* Price */}
      {product.base_price !== null && (
        <span className="flex-shrink-0 text-sm font-semibold text-primary">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            product.base_price,
          )}
        </span>
      )}
    </article>
  );
});

// ── Table View ───────────────────────────────────────────────────────────────
export function NoveltyTableView({
  products,
  selectionMode = false,
  selectedIds = [],
  onSelect,
  onStatusClick: _onStatusClick,
  colorsByProduct,
}: {
  products: NoveltyWithDetails[];
  selectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onStatusClick?: (type: string) => void;
  colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && <TableHead className="w-10" />}
            <TableHead className="min-w-[200px]">Produto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Novidade</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Cores</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="text-right">Estoque</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const isSelected = selectedIds.includes(product.product_id);
            return (
              <TableRow
                key={product.novelty_id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  isSelected && 'bg-primary/5',
                )}
                onClick={() => onSelect?.(product.product_id)}
              >
                {selectionMode && (
                  <TableCell className="px-2 py-1.5">
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border-2',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground',
                      )}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-muted/20">
                      {product.product_image ? (
                        <img
                          src={product.product_image}
                          alt={product.product_name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-1 text-sm font-medium">
                      {product.product_name ?? '—'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.product_sku ?? '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <NoveltyBadge
                    daysRemaining={product.days_remaining}
                    size="sm"
                    onClick={() => {}}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-sm font-medium">
                  {product.base_price !== null
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        product.base_price,
                      )
                    : '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <ProductColorSwatches
                    colors={colorsByProduct?.get(product.product_id)}
                    max={5}
                    size="sm"
                    hideWhenEmpty={false}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.category_name ?? '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-xs text-muted-foreground">
                  {product.supplier_name ?? '—'}
                </TableCell>
                <TableCell className="px-2 py-1.5 text-right text-sm">
                  <span
                    className={cn(
                      'font-medium',
                      product.stock_quantity === 0 ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    {product.stock_quantity ?? 0}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
