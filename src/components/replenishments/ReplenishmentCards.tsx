import React, { memo, useCallback, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Building2 } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReplenishmentBadge } from '@/components/products/ReplenishmentBadge';
import { ProductSparkline } from '@/components/products/ProductSparkline';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';
import { cn } from '@/lib/utils';
import type { ReplenishmentWithDetails, StockStatus } from '@/hooks/products';
import { productCardStyles } from '@/components/products/product-card-styles';
import { ProductQuickActionsFAB } from '@/components/products/ProductQuickActionsFAB';
import { HoverSetImage } from '@/components/products/HoverSetImage';
import { ProductCategoryBadges } from '@/components/products/ProductCategoryBadges';
import { getSupplierColors } from '@/lib/supplier-colors';
import { QuickViewThumb } from '@/components/products/QuickViewThumb';

// ─── Helpers ─────────────────────────────────────────────────────

function isRecent(replenishedAt: string): boolean {
  return Math.floor((Date.now() - new Date(replenishedAt).getTime()) / 86_400_000) <= 2;
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata quantidade de estoque de forma compacta para evitar overflow em
 * cards estreitos (ex: 7624 → "7,6 mil"; 1_250_000 → "1,2 mi").
 */
function formatStockQty(qty: number): string {
  if (!Number.isFinite(qty) || qty < 0) return '0';
  const q = Math.floor(qty);
  if (q >= 1_000_000) {
    return `${(q / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  // Promove para "mi" quando arredondamento estouraria para 1000 mil
  if (q >= 950_000) return '1 mi';
  if (q >= 10_000) {
    return `${Math.round(q / 1000).toLocaleString('pt-BR')} mil`;
  }
  if (q >= 1_000) {
    return `${(q / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return q.toLocaleString('pt-BR');
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
  const stockQty = product.stock_quantity;
  const stockConfig = STOCK_CONFIG[product.stock_status];

  // Mini-carrossel de variantes (paridade com ProductCard do catálogo): clicar
  // num swatch troca a foto principal pela imagem da variante selecionada.
  const [activeColorName, setActiveColorName] = useState<string | null>(null);
  const activeImage = useMemo(() => {
    if (!activeColorName || !colors?.length) return product.product_image;
    const match = colors.find((c) => c.name?.toLowerCase() === activeColorName.toLowerCase());
    return match?.image || product.product_image;
  }, [activeColorName, colors, product.product_image]);

  const handleClick = useCallback(() => {
    if (selectionMode) onToggleSelect();
    else onClick();
  }, [selectionMode, onToggleSelect, onClick]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const stockLabel = `${stockQty.toLocaleString('pt-BR')} unidades em estoque`;

  return (
    <article
      data-testid="replenishment-grid-card"
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3 transition-all',
        'hover:border-primary/40 hover:shadow-md',
        'min-h-[420px]',
        recent && 'shadow-[0_0_16px_hsl(var(--info)/0.06)]',
        isSelected && 'border-primary ring-2 ring-primary/20',
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
      {/* FAB "+" — paridade total com ProductCard */}
      {!selectionMode && (
        <ProductQuickActionsFAB
          productId={product.product_id}
          productName={product.product_name}
          productSku={product.product_sku}
          productImageUrl={activeImage}
          productPrice={product.base_price ?? 0}
          productMinQuantity={product.min_quantity || 1}
          isOutOfStock={product.stock_status === 'out-of-stock'}
        />
      )}

      {/* Image — mesmo padrão do NoveltyGridCard (aspect-square + rounded-lg) */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/20">
        <QuickViewThumb
          productId={product.product_id}
          productName={product.product_name}
          testId="replenishment-grid-card-thumb"
          className="h-full w-full"
        >
          <HoverSetImage
            key={activeImage ?? product.product_image ?? 'placeholder'}
            primary={activeImage}
            set={activeColorName ? null : product.product_set_image}
            alt={`Foto de ${product.product_name}`}
            fallbackIconClassName="h-8 w-8 text-muted-foreground/30"
            priority={priority}
          />
        </QuickViewThumb>

        {/* Badge superior esquerdo — Reposição */}
        <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
          <ReplenishmentBadge daysSince={product.days_since} size="sm" />
        </div>

        {/* Checkbox de seleção em massa */}
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
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1">
        {/* 1 — Categoria */}
        {product.category_id && product.category_name && (
          <ProductCategoryBadges
            category={{ id: product.category_id, name: product.category_name }}
            categoryUuid={product.category_id}
            className="flex-wrap"
          />
        )}

        {/* 2 — Fornecedor + 3 — SKU (mesma linha) */}
        {(product.supplier_name || product.product_sku) && (
          <div className="flex min-w-0 items-center justify-between gap-2">
            {product.supplier_name ? (
              <span
                className="flex min-w-0 items-center gap-1.5 truncate rounded-lg border border-border/20 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs"
                title={`Fornecedor: ${product.supplier_name}`}
              >
                <Building2
                  className={cn('h-3 w-3 shrink-0', getSupplierColors(product.supplier_name).text)}
                  aria-hidden="true"
                />
                <span className="truncate">{product.supplier_name}</span>
              </span>
            ) : (
              <span />
            )}
            {product.product_sku && (
              <span
                className="shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:text-xs"
                aria-label={`Código do produto: ${product.product_sku}`}
              >
                {product.product_sku}
              </span>
            )}
          </div>
        )}

        {/* 4 — Nome do produto */}
        <p
          className="line-clamp-2 min-h-[2.5rem] break-words text-sm font-medium leading-tight"
          title={product.product_name ?? undefined}
        >
          {product.product_name ?? '—'}
        </p>

        {/* 5 — Bolinhas de cores */}
        <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
          <ProductColorSwatches
            colors={colors}
            max={5}
            size="sm"
            hideWhenEmpty={false}
            selectedName={activeColorName}
            onSelect={(c) => setActiveColorName(c.name)}
          />
        </div>

        {/* 6 — Preço + Tiragem (estoque) ancorados ao final */}
        <div
          data-testid="replenishment-card-footer"
          className="mt-auto flex min-h-[2.75rem] items-end justify-between gap-2 pt-2"
        >
          {product.base_price !== null && product.base_price > 0 ? (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[10px] font-medium text-muted-foreground">A partir de</span>
              <p className="truncate text-sm font-semibold text-primary">
                {formatPrice(product.base_price)}
              </p>
            </div>
          ) : (
            <span className="text-xs italic text-muted-foreground">Sob consulta</span>
          )}

          <div className="flex flex-col items-end gap-0.5">
            <span className={cn('stock-indicator text-[10px] sm:text-xs', stockConfig.className)}>
              <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
              <span className="hidden sm:inline">{stockConfig.label}</span>
              <span className="sm:hidden" aria-label={stockConfig.label}>
                {stockConfig.mobileIcon}
              </span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="cursor-help text-[10px] tabular-nums text-muted-foreground sm:text-xs"
                  aria-label={stockLabel}
                >
                  {formatStockQty(stockQty)} un.
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {stockLabel}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Sparkline — específico de Reposição (mantido p/ contexto de saídas) */}
        <div className="border-t border-border/40 pt-1.5">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
              Saídas 90d
            </span>
          </div>
          <ProductSparkline productId={product.product_id} />
        </div>
      </div>
    </article>
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
