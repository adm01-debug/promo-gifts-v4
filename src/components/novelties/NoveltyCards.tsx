/**
 * NoveltyCards — Grid, List, Table, and Skeleton card components for novelties.
 * Follows the same info pattern as ProductCard (catalog).
 */

import { memo, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2, FolderTree, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { NoveltyBadge } from '@/components/products/NoveltyBadge';
import { ProductStatusBadge } from '@/components/products/ProductStatusBadge';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import { QuickViewThumb } from '@/components/products/QuickViewThumb';
import { BaseProductGridCard } from '@/components/products/BaseProductGridCard';

interface NoveltyCardProps {
  product: NoveltyWithDetails;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onStatusClick?: (type: string) => void;
  colors?: readonly ColorDotLike[];
  /**
   * Quando true, renderiza placeholders no lugar do preço e do estoque.
   * Útil enquanto os dados de pricing/estoque ainda estão sendo carregados
   * (ex.: hidratação assíncrona após o primeiro paint do card).
   */
  isPriceStockLoading?: boolean;
  /** Carrega imagem com alta prioridade (LCP) — true para cards above-the-fold */
  priority?: boolean;
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
  isPriceStockLoading = false,
  priority = false,
}: NoveltyCardProps) {
  // "Recém-chegado" agora vem da pipeline (detectado há ≤ 5 dias).
  const fresh = product.is_highlighted;

  return (
    <BaseProductGridCard
      testId="novelty-grid-card"
      thumbTestId="novelty-grid-card-thumb"
      footerTestId="novelty-card-footer"
      productId={product.product_id}
      productName={product.product_name ?? ''}
      productSku={product.product_sku}
      productImage={product.product_image}
      productSetImage={product.product_set_image}
      categoryId={product.category_id}
      categoryName={product.category_name}
      supplierName={product.supplier_name}
      basePrice={product.base_price}
      minQuantity={product.min_quantity}
      stockStatus={product.stock_status}
      stockQuantity={product.stock_quantity}
      colors={colors}
      selectionMode={selectionMode}
      isSelected={isSelected}
      isPriceStockLoading={isPriceStockLoading}
      priority={priority}
      onClick={() => onSelect?.(product.product_id)}
      renderSelectionIndicator={() =>
        selectionMode ? (
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
        ) : null
      }
      renderImageOverlays={() => (
        <>
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            <NoveltyBadge
              daysRemaining={product.days_remaining}
              daysElapsed={product.days_as_novelty}
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
          {product.status === 'expiring_soon' && !fresh && !selectionMode && (
            <div className="absolute right-2 top-2">
              <span
                data-testid="novelty-expiring-badge"
                className="inline-flex items-center gap-0.5 rounded-full bg-warning px-1.5 py-0.5 text-[9px] font-bold text-warning-foreground shadow-md"
              >
                <Clock className="h-2.5 w-2.5" />
                {product.days_remaining <= 1 ? 'Último dia' : `Últimos ${product.days_remaining}d`}
              </span>
            </div>
          )}
        </>
      )}
    />
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
  // "Recém-chegado" agora vem da pipeline (detectado há ≤ 5 dias). Antes era
  // `days_remaining >= 25`, que com a janela real (~60 dias) seria sempre true.
  const fresh = product.is_highlighted;

  // Mini-carrossel de variantes — mesmo comportamento do grid.
  const [activeColorName, setActiveColorName] = useState<string | null>(null);
  const activeImage = useMemo(() => {
    if (!activeColorName || !colors?.length) return product.product_image;
    const match = colors.find((c) => c.name?.toLowerCase() === activeColorName.toLowerCase());
    return match?.image || product.product_image;
  }, [activeColorName, colors, product.product_image]);

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
        <QuickViewThumb
          productId={product.product_id}
          productName={product.product_name ?? 'Produto'}
          testId="novelty-list-card-thumb"
          className="h-full w-full"
        >
          {activeImage ? (
            <img
              key={activeImage}
              src={activeImage}
              alt={product.product_name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
              }}
              className="h-full w-full object-contain transition-opacity duration-200"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-5 w-5 text-muted-foreground/30" />
            </div>
          )}
        </QuickViewThumb>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <NoveltyBadge
            daysRemaining={product.days_remaining}
            daysElapsed={product.days_as_novelty}
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
          <ProductColorSwatches
            colors={colors}
            max={5}
            size="xs"
            hideWhenEmpty={false}
            selectedName={activeColorName}
            onSelect={(c) => setActiveColorName(c.name)}
          />
        </div>
      </div>

      {/* Price */}
      {typeof product.base_price === 'number' &&
        Number.isFinite(product.base_price) &&
        product.base_price > 0 && (
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
                      <QuickViewThumb
                        productId={product.product_id}
                        productName={product.product_name ?? 'Produto'}
                        testId="novelty-table-row-thumb"
                        className="h-full w-full"
                      >
                        {product.product_image ? (
                          <img
                            src={product.product_image}
                            alt={product.product_name}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/placeholder.svg';
                            }}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </QuickViewThumb>
                    </div>
                    <span
                      className="line-clamp-1 text-sm font-medium"
                      title={product.product_name ?? undefined}
                    >
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
                    daysElapsed={product.days_as_novelty}
                    size="sm"
                    onClick={() => {}}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-sm font-medium">
                  {typeof product.base_price === 'number' &&
                  Number.isFinite(product.base_price) &&
                  product.base_price > 0
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
