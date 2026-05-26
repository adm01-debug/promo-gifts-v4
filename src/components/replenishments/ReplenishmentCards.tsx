import React, { memo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2, FolderTree } from 'lucide-react';
import { ReplenishmentBadge } from '@/components/products/ReplenishmentBadge';
import { ProductSparkline } from '@/components/products/ProductSparkline';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { cn } from '@/lib/utils';
import type { ReplenishmentWithDetails, StockStatus } from '@/hooks/products';

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
    'out-of-stock': { className: 'out-of-stock', label: 'Sem estoque', mobileIcon: '✗' },
  };

// ─── Grid Card ───────────────────────────────────────────────────

export interface ReplenishmentCardProps {
  readonly product: ReplenishmentWithDetails;
  readonly onClick: () => void;
  readonly selectionMode: boolean;
  readonly isSelected: boolean;
  readonly onToggleSelect: () => void;
}

export const ReplenishmentGridCard = memo(function ReplenishmentGridCard({
  product,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelect,
}: ReplenishmentCardProps) {
  const recent = isRecent(product.replenished_at);
  const stockQty = product.stock_quantity;
  const stockConfig = STOCK_CONFIG[product.stock_status];

  const handleClick = useCallback(() => {
    if (selectionMode) onToggleSelect();
    else onClick();
  }, [selectionMode, onToggleSelect, onClick]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 sm:rounded-2xl',
        'border-border/50 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
        recent && 'shadow-[0_0_16px_hsl(var(--info)/0.06)]',
        isSelected &&
          'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.15)] ring-2 ring-primary',
      )}
      onClick={handleClick}
      role="article"
      aria-label={`${product.product_name} — ${stockConfig.label}, ${formatPrice(product.base_price ?? 0)}`}
      aria-selected={selectionMode ? isSelected : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <CardContent className="p-0">
        {/* Image Section */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
          {product.product_image ? (
            <img
              src={product.product_image}
              alt={`Foto de ${product.product_name}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
              <Package className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}

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

          <div className="absolute left-2 top-2">
            <ReplenishmentBadge daysSince={product.days_since} size="sm" />
          </div>

          <div
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden="true"
          />
        </div>

        {/* Content Section */}
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
                <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                {product.supplier_name}
              </span>
            )}
          </div>

          {/* Name */}
          <h3 className="line-clamp-2 min-h-[2.25rem] font-display text-sm font-semibold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:min-h-[2.75rem] sm:text-base">
            {product.product_name}
          </h3>

          {/* Price + Stock */}
          <div className="flex items-end justify-between pt-0.5 sm:pt-1">
            <div>
              {product.base_price !== null && product.base_price > 0 ? (
                <>
                  <p className="mb-0.5 text-[10px] text-muted-foreground sm:text-xs">A partir de</p>
                  <span className="font-display text-base font-bold tabular-nums text-foreground sm:text-xl">
                    {formatPrice(product.base_price)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Preço sob consulta</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 sm:gap-1">
              <span className={cn('stock-indicator text-[10px] sm:text-xs', stockConfig.className)}>
                <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
                <span className="hidden sm:inline">{stockConfig.label}</span>
                <span className="sm:hidden" aria-label={stockConfig.label}>
                  {stockConfig.mobileIcon}
                </span>
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground sm:text-xs">
                {stockQty.toLocaleString('pt-BR')} un.
              </span>
            </div>
          </div>

          {/* Category */}
          {product.category_name && (
            <div className="mt-0.5 flex flex-wrap gap-1.5 border-t border-primary/20 pt-1.5">
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm shadow-primary/10 sm:text-xs">
                <FolderTree className="h-2.5 w-2.5" aria-hidden="true" />
                {product.category_name}
              </span>
            </div>
          )}

          {/* Sparkline */}
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

// ─── Table View ──────────────────────────────────────────────────

interface ReplenishmentTableViewProps {
  readonly products: readonly ReplenishmentWithDetails[];
  readonly onProductClick: (id: string) => void;
  readonly selectionMode: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleSelect: (id: string) => void;
}

export function ReplenishmentTableView({
  products,
  onProductClick,
  selectionMode,
  selectedIds,
  onToggleSelect,
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
                    selectionMode
                      ? onToggleSelect(product.product_id)
                      : onProductClick(product.product_id);
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
                    {product.product_image ? (
                      <img
                        src={product.product_image}
                        alt={`Foto de ${product.product_name}`}
                        className="h-full w-full object-cover"
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
