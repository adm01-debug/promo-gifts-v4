import React, { memo, useCallback } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package } from 'lucide-react';

import { ReplenishmentBadge } from '@/components/products/ReplenishmentBadge';
import { ProductSparkline } from '@/components/products/ProductSparkline';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { type ColorDotLike, ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { cn } from '@/lib/utils';
import type { ReplenishmentWithDetails, StockStatus } from '@/hooks/products';

import { QuickViewThumb } from '@/components/products/QuickViewThumb';
import { BaseProductGridCard } from '@/components/products/BaseProductGridCard';

// ─── Helpers ─────────────────────────────────────────────────────

function isRecent(replenishedAt: string): boolean {
  return Math.floor((Date.now() - new Date(replenishedAt).getTime()) / 86_400_000) <= 2;
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STOCK_CONFIG: Record<StockStatus, { className: string; label: string; mobileIcon: string }> =
  {
    'in-stock': { className: 'in-stock', label: 'Em estoque', mobileIcon: '✓' },
    'low-stock': { className: 'low-stock', label: 'Estoque baixo', mobileIcon: '!' },
    'out-of-stock': { className: 'out-of-stock', label: 'Estoque zerado', mobileIcon: '✗' },
  };

// ─── Grid Card ───────────────────────────────────────────────────

export interface ReplenishmentCardProps {
  readonly product: ReplenishmentWithDetails;
  readonly onClick: () => void;
  readonly selectionMode: boolean;
  readonly isSelected: boolean;
  readonly onToggleSelect: () => void;
  readonly colors?: readonly ColorDotLike[];
  /** Carrega imagem com alta prioridade (LCP) — true para cards above-the-fold */
  readonly priority?: boolean;
}

export const ReplenishmentGridCard = memo(function ReplenishmentGridCard({
  product,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelect,
  colors,
  priority = false,
}: ReplenishmentCardProps) {
  const recent = isRecent(product.replenished_at);

  const handleClick = useCallback(() => {
    if (selectionMode) onToggleSelect();
    else onClick();
  }, [selectionMode, onToggleSelect, onClick]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <BaseProductGridCard
      testId="replenishment-grid-card"
      thumbTestId="replenishment-grid-card-thumb"
      footerTestId="replenishment-card-footer"
      productId={product.product_id}
      productName={product.product_name}
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
      onClick={handleClick}
      priority={priority}
      className={cn(recent && 'shadow-[0_0_16px_hsl(var(--info)/0.06)]')}
      renderImageOverlays={() => (
        <>
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
            <ReplenishmentBadge daysSince={product.days_since} size="sm" />
          </div>
          {selectionMode && (
            <div
              className="absolute right-2 top-2 z-10"
              onClick={handleCheckboxClick}
              role="group"
              aria-label="Seleção"
            >
              <SelectionCheckbox
                checked={isSelected}
                onChange={onToggleSelect}
                size="md"
                animateEntry
                aria-label={`Selecionar ${product.product_name}`}
              />
            </div>
          )}
        </>
      )}
      renderFooterExtras={() => (
        <div className="border-t border-border/40 pt-1.5">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
              Saídas 90d
            </span>
          </div>
          <ProductSparkline productId={product.product_id} />
        </div>
      )}
    />
  );
});


// ─── Table View ──────────────────────────────────────────────────

interface ReplenishmentTableViewProps {
  readonly products: readonly ReplenishmentWithDetails[];
  readonly onProductClick: (id: string) => void;
  readonly selectionMode: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelect: (id: string) => void;
  readonly colorsByProduct?: ReadonlyMap<string, readonly ColorDotLike[]>;
}

export function ReplenishmentTableView({
  products,
  onProductClick,
  selectionMode,
  selectedIds,
  onToggleSelect,
  colorsByProduct,
}: ReplenishmentTableViewProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border/50"
      role="region"
      aria-label="Tabela de produtos repostos"
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {selectionMode && <TableHead className="w-[40px] px-2" aria-label="Seleção" />}
            <TableHead className="w-[44px] px-2">Img</TableHead>
            <TableHead className="px-2">Produto</TableHead>
            <TableHead className="hidden px-2 sm:table-cell">SKU</TableHead>
            <TableHead className="hidden px-2 md:table-cell">Fornecedor</TableHead>
            <TableHead className="hidden px-2 lg:table-cell">Categoria</TableHead>
            <TableHead className="hidden px-2 md:table-cell">Cores</TableHead>
            <TableHead className="px-2 text-center">Status</TableHead>
            <TableHead className="px-2 text-center">Estoque</TableHead>
            <TableHead className="px-2 text-right">Preço</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const recent = isRecent(product.replenished_at);
            const isSelected = selectedIds.has(product.product_id);
            const stockConfig = STOCK_CONFIG[product.stock_status];
            const stockQty = product.stock_quantity;

            return (
              <TableRow
                key={product.replenishment_id}
                className={cn(
                  'cursor-pointer transition-colors',
                  recent && 'bg-info/5',
                  isSelected && 'bg-primary/10',
                )}
                onClick={() =>
                  selectionMode
                    ? onToggleSelect(product.product_id)
                    : onProductClick(product.product_id)
                }
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (selectionMode) {
                      onToggleSelect(product.product_id);
                    } else {
                      onProductClick(product.product_id);
                    }
                  }
                }}
                aria-selected={selectionMode ? isSelected : undefined}
              >
                {selectionMode && (
                  <TableCell className="p-1.5">
                    <div onClick={(e) => e.stopPropagation()}>
                      <SelectionCheckbox
                        checked={isSelected}
                        onChange={() => onToggleSelect(product.product_id)}
                        size="sm"
                        aria-label={`Selecionar ${product.product_name}`}
                      />
                    </div>
                  </TableCell>
                )}
                <TableCell className="p-1.5">
                  <div className="h-9 w-9 overflow-hidden rounded bg-muted">
                    <QuickViewThumb
                      productId={product.product_id}
                      productName={product.product_name}
                      testId="replenishment-table-row-thumb"
                      className="h-full w-full"
                    >
                      {product.product_image ? (
                        <img
                          src={product.product_image}
                          alt={`Foto de ${product.product_name}`}
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.onerror = null;
                            img.src = '/placeholder.svg';
                          }}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center"
                          aria-hidden="true"
                        >
                          <Package className="h-3.5 w-3.5 text-muted-foreground/30" />
                        </div>
                      )}
                    </QuickViewThumb>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <p className="line-clamp-1 text-xs font-medium">{product.product_name}</p>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 sm:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.product_sku ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 md:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.supplier_name ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 lg:table-cell">
                  <span className="text-[11px] text-muted-foreground">
                    {product.category_name ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden px-2 py-1.5 md:table-cell">
                  <ProductColorSwatches
                    colors={colorsByProduct?.get(product.product_id)}
                    max={5}
                    size="sm"
                    hideWhenEmpty={false}
                  />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <ReplenishmentBadge daysSince={product.days_since} size="sm" />
                </TableCell>
                <TableCell className="px-2 py-1.5 text-center">
                  <span className={cn('stock-indicator text-[10px]', stockConfig.className)}>
                    <Package className="h-2.5 w-2.5" aria-hidden="true" />
                    {stockConfig.label}
                  </span>
                  <p className="text-[10px] tabular-nums text-muted-foreground">
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
