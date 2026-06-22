/**
 * ProductTableRow — Linha isolada da tabela de produtos virtualizada.
 *
 * Extraída de ProductTableView para que cada linha possa ter hooks React próprios.
 * Hooks não podem ser chamados dentro de Array.map() — separar em componente é
 * o único caminho para ter useExternalVariantStock por produto na tabela.
 *
 * FIX-COLOR-SEL-03 (2026-06-21): ao clicar numa bolinha de cor na tabela,
 * foto e estoque agora refletem a variante selecionada (paridade com grid/lista).
 * Cadeia de prioridade foto: colors[].image (batch) → live thumbnail → filtro → primária
 * Cadeia de prioridade estoque: liveStockQty (BD real) → colors[].stock (batch) → total
 */
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import {
  resolveColorImage,
  resolveColorStock,
  getActiveColorName,
  type ActiveColorFilter,
} from '@/utils/color-image-resolver';
import { useExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import { useProductSelectionStore } from '@/stores/useProductSelectionStore';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { PriceFreshnessBadge } from '@/components/products/PriceFreshnessBadge';
import { SelectionCheckbox } from '@/components/common/SelectionCheckbox';
import { TableRowActions } from './TableRowActions';
import type { Product } from '@/types/product-catalog';
import type { VariantActionMode } from '@/components/products/VariantPickerDialog';

const rowPriceFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatRowPrice(price: number) {
  const formatted = rowPriceFormatter.format(price);
  const parts = formatted.split(/\s/);
  if (parts.length >= 2) {
    return (
      <span className="flex items-baseline justify-end gap-1">
        <span className="text-[9px] font-medium text-muted-foreground/50">R$</span>
        <span>{parts[parts.length - 1]}</span>
      </span>
    );
  }
  return formatted;
}

function rowStockColor(status: string) {
  if (status === 'in-stock') return 'text-success';
  if (status === 'low-stock') return 'text-warning';
  return 'text-destructive';
}

export interface ProductTableRowProps {
  product: Product;
  virtualStart: number;
  measureRef: (el: Element | null) => void;
  dataIndex: number;
  selectionMode: boolean;
  isSelected: boolean;
  activeColorFilter: ActiveColorFilter | null;
  onProductClick?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  selectColorWithUrl: (id: string, name: string) => void;
  clearSelectedColor: (id: string) => void;
  canAddToCompare: boolean;
  isFavorite?: (id: string) => boolean;
  isInCompare?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
  onToggleCompare?: (id: string) => { added: boolean; isFull: boolean };
  onOpenVariantPicker: (product: Product, mode: VariantActionMode) => void;
  onOpenQuickView: (product: Product, triggerEl?: HTMLElement | null, initialColorName?: string | null) => void;
  quickViewOpen: boolean;
  variantPickerOpen: boolean;
  collectionModalOpen: boolean;
  shareDialogOpen: boolean;
}

export const ProductTableRow = memo(({
  product,
  virtualStart,
  measureRef,
  dataIndex,
  selectionMode,
  isSelected,
  activeColorFilter,
  onProductClick,
  onToggleSelect,
  selectColorWithUrl,
  clearSelectedColor,
  canAddToCompare,
  isFavorite,
  isInCompare,
  onToggleFavorite,
  onToggleCompare,
  onOpenVariantPicker,
  onOpenQuickView,
  quickViewOpen,
  variantPickerOpen,
  collectionModalOpen,
  shareDialogOpen,
}: ProductTableRowProps) => {
  // Cor selecionada manualmente nesta linha — lida do store global (SSOT)
  const userSelectedColorName =
    useProductSelectionStore((s) => s.selectedColors[product.id]) ?? null;

  // FIX-COLOR-SEL-03: busca dados reais da variante ao selecionar cor.
  // Dispara SOMENTE quando o usuário clicou numa bolinha — zero overhead no mount.
  // Cache 15min compartilhado com ProductCard/ProductListItem.
  const { data: liveVariants } = useExternalVariantStock(
    userSelectedColorName ? product.id : undefined,
  );

  const liveMatchForColor =
    userSelectedColorName && liveVariants?.length
      ? liveVariants.find(
          (v) => (v.color_name || '').toLowerCase() === userSelectedColorName.toLowerCase(),
        )
      : undefined;
  const liveImage = liveMatchForColor?.selected_thumbnail || undefined;
  const liveStockQty: number | null = liveMatchForColor?.stock_quantity ?? null;

  // Foto: colors[].image (FIX-1 batch) > live thumbnail > filtro > primária
  const userSelectedColor =
    userSelectedColorName && product.colors?.length
      ? product.colors.find(
          (c) => c.name.toLowerCase() === userSelectedColorName.toLowerCase(),
        ) || null
      : null;
  const colorSpecificImage = resolveColorImage(product, activeColorFilter);
  const rawImg =
    (userSelectedColor as { image?: string | null } | null)?.image ||
    liveImage ||
    colorSpecificImage ||
    product.primary_image_url ||
    product.og_image_url ||
    product.images[0] ||
    null;
  const thumbUrl = rawImg ? getCdnUrl(rawImg, 'card') : '/placeholder.svg';

  // Estoque: liveStockQty (BD real) > batch (colors[].stock) > total
  const colorStock = resolveColorStock(product, activeColorFilter, userSelectedColorName);
  const displayStock =
    liveStockQty !== null ? liveStockQty : (colorStock?.stock ?? product.stock);
  const displayStatus =
    liveStockQty !== null
      ? getCatalogStockStatus(liveStockQty, undefined, product.minQuantity)
      : (colorStock?.stockStatus ?? product.stockStatus);

  const activeColorName =
    userSelectedColorName || getActiveColorName(product, activeColorFilter);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect?.(product.id);
    } else {
      onProductClick?.(product.id);
    }
  };

  const handleOpenQV = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (variantPickerOpen || collectionModalOpen || shareDialogOpen || quickViewOpen) return;
    onOpenQuickView(product, e.currentTarget as HTMLElement);
  };

  return (
    <div
      data-index={dataIndex}
      ref={measureRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualStart}px)`,
      }}
      className={cn(
        'group flex h-14 cursor-pointer items-center border-b border-border/30 px-4 transition-colors hover:bg-accent/30',
        isSelected && 'bg-primary/5',
      )}
      onClick={handleClick}
    >
      {selectionMode && (
        <div className="flex w-10 justify-center px-2">
          <SelectionCheckbox
            checked={!!isSelected}
            onChange={() => onToggleSelect?.(product.id)}
            size="sm"
          />
        </div>
      )}

      <div className="hidden w-40 truncate px-3 text-xs text-muted-foreground lg:block">
        {product.supplier?.name}
      </div>

      {/* Thumbnail — QuickView ao clicar */}
      <div className="w-12 px-2">
        <div
          role="button"
          tabIndex={0}
          aria-label={`Visualização rápida de ${product.name}`}
          aria-haspopup="dialog"
          aria-expanded={quickViewOpen}
          data-testid="product-table-row-thumb"
          data-product-id={product.id}
          className="group/thumb h-10 w-10 cursor-zoom-in overflow-hidden rounded-md border border-border/30 bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ touchAction: 'manipulation' }}
          onClick={handleOpenQV}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenQV(e); }
          }}
        >
          <img
            src={thumbUrl}
            alt=""
            className="h-full w-full object-contain transition-transform duration-300 group-hover/thumb:scale-105"
            loading="lazy"
          />
        </div>
      </div>

      {/* Nome + badge cor */}
      <div className="min-w-0 flex-1 px-3">
        <p className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
          {product.name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground md:hidden">{product.sku}</p>
          {activeColorName && (
            <Badge variant="outline" className="h-4 border-primary/30 px-1.5 py-0 text-[9px] text-primary/80">
              {activeColorName}
            </Badge>
          )}
        </div>
      </div>

      {/* SKU */}
      <div className="hidden w-32 truncate px-3 font-mono text-xs text-muted-foreground md:block">
        {product.sku}
      </div>

      {/* Bolinhas de cor + botão Todos */}
      <div
        className="hidden w-44 items-center gap-1.5 px-3 sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        {product.colors.length > 0 ? (
          <ProductColorSwatches
            colors={product.colors.map((c) => ({
              name: c.name,
              hex: c.hex ?? null,
              image: (c as { image?: string | null }).image ?? null,
            }))}
            max={5}
            size="sm"
            hideWhenEmpty={false}
            selectedName={userSelectedColorName}
            onSelect={(c) => selectColorWithUrl(product.id, c.name)}
            onClear={() => clearSelectedColor(product.id)}
          />
        ) : (
          <div className="h-1 w-2 rounded-full bg-muted-foreground/20" />
        )}
      </div>

      {/* Estoque */}
      <div
        className={cn(
          'flex w-32 items-center justify-end gap-1.5 px-3 text-right text-[11px] font-bold tracking-tight',
          rowStockColor(displayStatus),
        )}
        data-testid="product-stock-value"
        data-stock-qty={displayStock ?? 0}
      >
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            displayStatus === 'in-stock'
              ? 'animate-pulse bg-success'
              : displayStatus === 'low-stock'
                ? 'bg-warning'
                : 'bg-destructive',
          )}
        />
        {(displayStock || 0).toLocaleString('pt-BR')}
      </div>

      {/* Preço */}
      <div className="inline-flex w-32 items-center justify-end gap-1 px-3 text-right text-[13px] font-bold">
        {formatRowPrice(product.price)}
        <PriceFreshnessBadge priceUpdatedAt={product.priceUpdatedAt} variant="icon-only" />
      </div>

      {/* Ações */}
      <div className="w-48 shrink-0 px-1">
        <TableRowActions
          product={product}
          isFavorite={isFavorite?.(product.id) || false}
          isInCompare={isInCompare?.(product.id) || false}
          canAddToCompare={canAddToCompare}
          onToggleFavorite={onToggleFavorite}
          onToggleCompare={onToggleCompare}
          onOpenVariantPicker={onOpenVariantPicker}
          onOpenQuickView={(p) => onOpenQuickView(p)}
        />
      </div>
    </div>
  );
});

ProductTableRow.displayName = 'ProductTableRow';
