/**
 * BaseProductGridCard — Shell compartilhada entre NoveltyGridCard e
 * ReplenishmentGridCard. Garante paridade visual absoluta (mesmo tamanho,
 * mesma ordem de campos, mesmo footer) sem duplicação de JSX.
 *
 * Pattern: slots (render props) para overlays na imagem, indicador de seleção
 * e extras opcionais no rodapé (ex: sparkline de Reposição).
 *
 * Order renderizada:
 *   1. Imagem (aspect-square + rounded-lg) com overlays
 *   2. Categoria (ProductCategoryBadges)
 *   3. Fornecedor + SKU (mesma linha)
 *   4. Nome do produto (line-clamp-2, min-h-[2.5rem])
 *   5. Bolinhas de cores (ProductColorSwatches)
 *   6. Preço + StockBadge (ou skeletons quando isPriceStockLoading)
 *   7. Slot opcional renderFooterExtras (ex: sparkline)
 */
import { memo, useMemo, useState, type ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { StockBadge, getStockStatus, type StockStatus } from '@/components/inventory/StockBadge';
import {
  ProductColorSwatches,
  type ColorDotLike,
} from '@/components/products/ProductColorSwatches';
import { ProductCategoryBadges } from '@/components/products/ProductCategoryBadges';
import { ProductQuickActionsFAB } from '@/components/products/ProductQuickActionsFAB';
import { HoverSetImage } from '@/components/products/HoverSetImage';
import { QuickViewThumb } from '@/components/products/QuickViewThumb';
import { getSupplierColors } from '@/lib/supplier-colors';

export interface BaseProductGridCardProps {
  /** Identificação do produto */
  readonly productId: string;
  readonly productName: string;
  readonly productSku?: string | null;
  readonly productImage?: string | null;
  readonly productSetImage?: string | null;
  /** Categoria */
  readonly categoryId?: string | null;
  readonly categoryName?: string | null;
  /** Fornecedor */
  readonly supplierName?: string | null;
  /** Pricing / estoque */
  readonly basePrice?: number | null;
  readonly minQuantity?: number;
  readonly stockStatus?: StockStatus | null;
  readonly stockQuantity?: number | null;
  /** Variantes de cor (mini-carrossel) */
  readonly colors?: readonly ColorDotLike[];

  /** Comportamento */
  readonly selectionMode?: boolean;
  readonly isSelected?: boolean;
  readonly onClick?: () => void;
  readonly priority?: boolean;
  readonly isPriceStockLoading?: boolean;

  /** Test IDs customizáveis por módulo (Novidades / Reposição) */
  readonly testId?: string;
  readonly thumbTestId?: string;
  readonly footerTestId?: string;

  /** Estilo customizado opcional no <article> raiz */
  readonly className?: string;

  /** Slots — recebem o nome da cor ativa para sincronizar overlays */
  readonly renderImageOverlays?: (ctx: { activeColorName: string | null }) => ReactNode;
  readonly renderSelectionIndicator?: () => ReactNode;
  readonly renderFooterExtras?: () => ReactNode;
}

/**
 * Formata preço em BRL.
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

export const BaseProductGridCard = memo(
  ({
    productId,
    productName,
    productSku,
    productImage,
    productSetImage,
    categoryId,
    categoryName,
    supplierName,
    basePrice,
    minQuantity,
    stockStatus,
    stockQuantity,
    colors,
    selectionMode = false,
    isSelected = false,
    onClick,
    priority = false,
    isPriceStockLoading = false,
    testId,
    thumbTestId,
    footerTestId,
    className,
    renderImageOverlays,
    renderSelectionIndicator,
    renderFooterExtras,
  }: BaseProductGridCardProps) => {
    // Mini-carrossel de variantes — clicar num swatch troca a foto principal
    const [activeColorName, setActiveColorName] = useState<string | null>(null);
    const activeImage = useMemo(() => {
      if (!activeColorName || !colors?.length) return productImage;
      const match = colors.find((c) => c.name?.toLowerCase() === activeColorName.toLowerCase());
      return match?.image || productImage;
    }, [activeColorName, colors, productImage]);

    const hasValidPrice =
      typeof basePrice === 'number' && Number.isFinite(basePrice) && basePrice > 0;
    const resolvedStockStatus = stockStatus ?? getStockStatus(stockQuantity ?? 0, 10);

    return (
      <article
        data-testid={testId}
        className={cn(
          'group relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-3 transition-all',
          'hover:border-primary/40 hover:shadow-md',
          'min-h-[420px]',
          isSelected && 'border-primary ring-2 ring-primary/20',
          className,
        )}
        onClick={onClick}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {renderSelectionIndicator?.()}

        {/* FAB "+" — paridade total com ProductCard do catálogo */}
        {!selectionMode && (
          <ProductQuickActionsFAB
            productId={productId}
            productName={productName}
            productSku={productSku ?? undefined}
            productImageUrl={activeImage ?? undefined}
            productPrice={basePrice ?? 0}
            productMinQuantity={minQuantity || 1}
            isOutOfStock={resolvedStockStatus === 'out-of-stock'}
          />
        )}

        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/20">
          <QuickViewThumb
            productId={productId}
            productName={productName}
            testId={thumbTestId}
            className="h-full w-full"
          >
            <HoverSetImage
              key={activeImage ?? productImage ?? 'placeholder'}
              primary={activeImage ?? undefined}
              set={activeColorName ? null : productSetImage}
              alt={productName}
              fallbackIconClassName="h-8 w-8 text-muted-foreground/30"
              priority={priority}
            />
          </QuickViewThumb>
          {renderImageOverlays?.({ activeColorName })}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1">
          {/* 1 — Categoria */}
          {categoryId && categoryName && (
            <ProductCategoryBadges
              category={{ id: categoryId, name: categoryName }}
              categoryUuid={categoryId}
              className="flex-wrap"
            />
          )}

          {/* 2 — Fornecedor + 3 — SKU */}
          {(supplierName || productSku) && (
            <div className="flex min-w-0 items-center justify-between gap-2">
              {supplierName ? (
                <span
                  className="flex min-w-0 items-center gap-1.5 truncate rounded-lg border border-border/20 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs"
                  title={`Fornecedor: ${supplierName}`}
                >
                  <Building2
                    className={cn('h-3 w-3 shrink-0', getSupplierColors(supplierName).text)}
                    aria-hidden="true"
                  />
                  <span className="truncate">{supplierName}</span>
                </span>
              ) : (
                <span />
              )}
              {productSku && (
                <span
                  className="shrink-0 truncate font-mono text-[10px] text-muted-foreground sm:text-xs"
                  aria-label={`Código do produto: ${productSku}`}
                >
                  {productSku}
                </span>
              )}
            </div>
          )}

          {/* 4 — Nome do produto */}
          <p
            data-testid="product-card-name"
            className="line-clamp-2 max-h-[2.4rem] min-h-[2.4rem] break-words font-display text-[11.2px] font-bold leading-tight tracking-tight sm:max-h-[2.8rem] sm:min-h-[2.8rem] sm:text-[12.8px]"
            title={productName}
          >
            {productName || '—'}
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

          {/* 6 — Preço + Estoque */}
          <div
            data-testid={footerTestId}
            className="mt-auto flex min-h-[2.75rem] items-end justify-between gap-2 pt-2"
          >
            {isPriceStockLoading ? (
              <div className="flex flex-col gap-1" aria-busy="true" aria-label="Carregando preço">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="h-4 w-20" />
              </div>
            ) : hasValidPrice ? (
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[10px] font-medium text-muted-foreground">A partir de</span>
                <p className="truncate text-sm font-semibold text-primary">
                  {formatPrice(basePrice ?? 0)}
                </p>
              </div>
            ) : (
              <span className="text-xs italic text-muted-foreground">Sob consulta</span>
            )}

            {isPriceStockLoading ? (
              <Skeleton className="h-5 w-16 rounded-full" aria-label="Carregando estoque" />
            ) : (
              <StockBadge
                status={resolvedStockStatus}
                quantity={stockQuantity ?? 0}
                showQuantity
                size="sm"
              />
            )}
          </div>

          {/* 7 — Extras opcionais (ex: sparkline em Reposição) */}
          {renderFooterExtras?.()}
        </div>
      </article>
    );
  },
);
