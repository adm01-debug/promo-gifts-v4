import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Package,
  Building2,
  FolderTree,
  Heart,
  GitCompare,
  Eye,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';

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
    'out-of-stock': { className: 'out-of-stock', label: 'Sem estoque', mobileIcon: '✗' },
  };

// ─── Quick Action Button (overlay) ───────────────────────────────

interface QuickActionProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: (e: React.MouseEvent) => void;
  readonly active?: boolean;
  readonly activeClass?: string;
}

const QuickAction = memo(function QuickAction({
  icon,
  label,
  onClick,
  active,
  activeClass,
}: QuickActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/95 text-foreground/70 shadow-sm backdrop-blur transition-all',
            'hover:scale-110 hover:border-primary/40 hover:text-primary',
            active && (activeClass ?? 'border-primary/60 bg-primary text-primary-foreground'),
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
});

// ─── Grid Card ───────────────────────────────────────────────────

export interface ReplenishmentCardProps {
  readonly product: ReplenishmentWithDetails;
  readonly onClick: () => void;
  readonly selectionMode: boolean;
  readonly isSelected: boolean;
  readonly onToggleSelect: () => void;
  readonly colors?: readonly ColorDotLike[];
  /** Nome do fornecedor #1 do período (vem de useReplenishmentStats). */
  readonly topSupplierName?: string | null;
}

export const ReplenishmentGridCard = memo(function ReplenishmentGridCard({
  product,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelect,
  colors,
  topSupplierName,
}: ReplenishmentCardProps) {
  const navigate = useNavigate();
  const recent = isRecent(product.replenished_at);
  const stockQty = product.stock_quantity;
  const stockConfig = STOCK_CONFIG[product.stock_status];

  // Stores — favoritos & comparação (quick actions)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorited = useFavoritesStore((s) => s.isFavorite(product.product_id));
  const toggleCompare = useComparisonStore((s) => s.toggleCompare);
  const isInCompare = useComparisonStore((s) => s.isInCompare(product.product_id));

  const handleClick = useCallback(() => {
    if (selectionMode) onToggleSelect();
    else onClick();
  }, [selectionMode, onToggleSelect, onClick]);

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(product.product_id);
    },
    [toggleFavorite, product.product_id],
  );

  const handleCompare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleCompare(product.product_id);
    },
    [toggleCompare, product.product_id],
  );

  const handleOpenDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  const handleAddToQuote = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/orcamentos/novo?productId=${product.product_id}`);
    },
    [navigate, product.product_id],
  );

  const stockLabel = `${stockQty.toLocaleString('pt-BR')} unidades em estoque`;

  return (
    <Card
      className={cn(
        productCardStyles.container,
        'h-[480px] max-h-[480px] min-h-[480px]', // Altura fixa para paridade no grid (inclui CTA)
        recent && 'shadow-[0_0_16px_hsl(var(--info)/0.06)]',
        isSelected && productCardStyles.selected,
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
      <CardContent className="flex h-full flex-col p-0">
        {/* Image Section */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
          {product.product_image ? (
            <img
              src={product.product_image}
              alt={`Foto de ${product.product_name}`}
              className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105 sm:p-3"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
              <Package className="h-12 w-12 text-muted-foreground/20" />
            </div>
          )}

          {/* Badge superior esquerdo — Reposição + Top fornecedor (stack) */}
          <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
            <ReplenishmentBadge daysSince={product.days_since} size="sm" />
            {topSupplierName &&
              product.supplier_name &&
              topSupplierName.toLowerCase() === product.supplier_name.toLowerCase() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_2px_8px_hsl(45_93%_47%/0.35)] sm:text-[10px]">
                      <span aria-hidden="true">★</span>
                      Top fornecedor
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    <p className="font-semibold">Fornecedor líder do período</p>
                    <p className="text-muted-foreground">
                      {topSupplierName} é o nº 1 em reposições nos últimos 30 dias.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
          </div>

          {/* Quick actions (hover) — canto superior direito */}
          {!selectionMode && (
            <div
              className={cn(
                'absolute right-2 top-2 z-10 flex flex-col gap-1.5 transition-all duration-200',
                'opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0',
                'group-focus-within:opacity-100 group-focus-within:translate-x-0',
                isFavorited && 'opacity-100 translate-x-0',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <QuickAction
                icon={<Heart className={cn('h-3.5 w-3.5', isFavorited && 'fill-current')} />}
                label={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                onClick={handleFavorite}
                active={isFavorited}
                activeClass="border-rose-500/60 bg-rose-500 text-white"
              />
              <QuickAction
                icon={<GitCompare className="h-3.5 w-3.5" />}
                label={isInCompare ? 'Remover da comparação' : 'Comparar produto'}
                onClick={handleCompare}
                active={isInCompare}
              />
              <QuickAction
                icon={<Eye className="h-3.5 w-3.5" />}
                label="Ver detalhes"
                onClick={handleOpenDetail}
              />
            </div>
          )}

          {/* Checkbox de seleção em massa (mantém posição quando ativa) */}
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

          <div
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden="true"
          />
        </div>

        {/* Content Section */}
        <div className={cn(productCardStyles.infoSection, 'flex flex-1 flex-col')}>
          {/* Meta line — SKU · Fornecedor (hierarquia: menor, muted) */}
          <div className="flex items-center justify-between gap-2">
            {product.product_sku && (
              <span className="truncate font-mono text-[10px] text-muted-foreground sm:text-xs">
                {product.product_sku}
              </span>
            )}
            {product.supplier_name && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex max-w-[120px] shrink-0 items-center gap-1 truncate rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground sm:px-2 sm:text-xs">
                    <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{product.supplier_name}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Fornecedor: {product.supplier_name}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Name — hierarquia principal */}
          <h3 className={productCardStyles.title}>{product.product_name}</h3>

          {/* Price + Stock */}
          <div className={productCardStyles.priceStockSection}>
            <div className={productCardStyles.priceContainer}>
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

          {/* Category */}
          {product.category_name && (
            <div className={productCardStyles.categoryBadgeSection}>
              <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm shadow-primary/10 sm:text-xs">
                <FolderTree className="h-2.5 w-2.5" aria-hidden="true" />
                {product.category_name}
              </span>
            </div>
          )}

          {/* Cores disponíveis */}
          <div className="flex items-center gap-1">
            <ProductColorSwatches colors={colors} max={5} size="sm" hideWhenEmpty={false} />
          </div>

          {/* Sparkline */}
          <div className={productCardStyles.sparklineSection}>
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                Tendência 30d
              </span>
            </div>
            <ProductSparkline productId={product.product_id} />
          </div>

          {/* CTA primário — aparece no hover (desktop) / sempre (mobile) */}
          <div
            className={cn(
              'mt-auto pt-2 transition-opacity duration-200',
              'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="default"
              className="h-8 w-full gap-1.5 text-xs font-semibold"
              onClick={handleAddToQuote}
              aria-label={`Adicionar ${product.product_name} a um orçamento`}
            >
              <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
              Adicionar a orçamento
            </Button>
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
