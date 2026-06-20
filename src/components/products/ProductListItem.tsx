/**
 * ProductListItem — Layout horizontal compacto para modo lista do catálogo.
 *
 * 🎨 DESIGN STRATEGY (NÃO ALTERAR):
 * - Densidade: ~8-10 produtos visíveis por tela (vs ~3 no card vertical)
 * - Scan horizontal: thumb → info → preço/estoque → ações
 * - Thumb 64-80px contém o produto sem dominar o layout
 * - Ações de hover no desktop, sempre visíveis no mobile
 * - Altura fixa ~72-88px para virtualização consistente
 *
 * ✅ PARIDADE COM GRID: Todas as ações rápidas do ProductCard (Grid)
 *    estão implementadas aqui com a mesma arquitetura de variante/cor:
 *    Favoritar, Comparar, Coleção, Share, Orçamento, Carrinho, QuickView
 */
import { memo, useState, useCallback, useRef, useEffect, useId } from 'react';
import { Package, Building2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NoveltyBadge } from './NoveltyBadge';
import { ProductStatusBadge } from './ProductStatusBadge';
import { ColorTooltipContent, colorTooltipClassName } from './ColorTooltipContent';
import { ListItemActions } from './list-item/ListItemActions';
import { useNavigate } from 'react-router-dom';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/hooks/products/useColorSystem';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import type { Product } from '@/types/product-catalog';
import { toast } from 'sonner';
import { GenderBadge } from './GenderBadge';
import { getSupplierColors } from '@/lib/supplier-colors';
import {
  resolveColorImage,
  resolveColorStock,
  getActiveColorName,
  type ActiveColorFilter,
} from '@/utils/color-image-resolver';
import { resolveHighlightHex } from '@/utils/color-group-hex';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { resolveAllMatchingColors } from '@/utils/color-variant-carousel';
import { ProductColorSwatches } from './ProductColorSwatches';
import { showUndoToast, showErrorToast } from '@/utils/undoToast';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { ProductQuickView } from './ProductQuickView';
import { SharePreviewDialog } from './share/SharePreviewDialog';
import { VariantPickerDialog, type VariantActionMode } from './VariantPickerDialog';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { CartSelectorDialog } from '@/components/cart/CartSelectorDialog';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { isProductKit } from '@/lib/products/kit-detection';

interface ProductListItemProps {
  product: Product;
  onClick?: () => void;
  onView?: (product: Product) => void;
  onShare?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  highlightColors?: string[];
  activeColorFilter?: ActiveColorFilter | null;
  isNovelty?: boolean;
  noveltyDaysRemaining?: number;
  noveltyDaysElapsed?: number;
  onStatusClick?: (type: string, value?: string | number) => void;
  /** Carrega imagem com alta prioridade (LCP) — true para itens above-the-fold */
  priority?: boolean;
}

export const ProductListItem = memo(
  ({
    product,
    onClick,
    onView,
    onShare,
    isFavorited = false,
    onToggleFavorite,
    isInCompare = false,
    onToggleCompare,
    canAddToCompare = true,
    highlightColors = [],
    activeColorFilter,
    isNovelty = false,
    noveltyDaysRemaining,
    noveltyDaysElapsed,
    onStatusClick,
    priority = false,
  }: ProductListItemProps) => {
    const navigate = useNavigate();
    const uid = useId();
    const stockLabelId = `stock-label-${uid}`;
    const colorsLabelId = `colors-label-${uid}`;
    const priceLabelId = `price-label-${uid}`;
    const detectedIsKit = isProductKit(product);
    const [collectionModalOpen, setCollectionModalOpen] = useState(false);
    const [collectionVariant, setCollectionVariant] = useState<
      | {
          color_name?: string | null;
          color_hex?: string | null;
          variant_id?: string | null;
          thumbnail?: string | null;
        }
      | undefined
    >(undefined);
    const [quickViewOpen, setQuickViewOpen] = useState(false);
    const quickViewTriggerRef = useRef<HTMLDivElement | null>(null);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareVariant, setShareVariant] = useState<{
      variantName?: string | null;
      colorHex?: string | null;
      thumbnailUrl?: string | null;
    } | null>(null);
    const [variantPickerOpen, setVariantPickerOpen] = useState(false);
    const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
    const [pendingVariant, setPendingVariant] = useState<ExternalVariantStock | null>(null);
    const { carts, addToActiveCart, canCreateCart } = useSellerCartContext();
    const actionBusyRef = useRef(false);
    const [activeVariantIdx, setActiveVariantIdx] = useState(0);
    // Cor selecionada manualmente via swatch (bolinha) — sobrescreve imagem/estoque exibidos
    const [userSelectedColorName, setUserSelectedColorName] = useState<string | null>(null);

    // Reset variant index when color filter changes
    const listFilterKey = activeColorFilter
      ? `${(activeColorFilter.groups || []).join(',')}|${(activeColorFilter.variations || []).join(',')}`
      : '';
    const prevListFilterRef = useRef(listFilterKey);
    useEffect(() => {
      if (prevListFilterRef.current !== listFilterKey) {
        setActiveVariantIdx(0);
        prevListFilterRef.current = listFilterKey;
      }
    }, [listFilterKey]);
    const favStore = useFavoritesStore();
    const compStore = useComparisonStore();

    const handleStatusClick = useCallback(
      (type: string, _value?: string | number) => {
        if (onStatusClick) {
          onStatusClick(type, _value);
          return;
        }

        switch (type) {
          case 'novelty':
            navigate('/novidades');
            break;
          case 'promotion':
            navigate('/filtros?onSale=1');
            break;
          case 'featured':
            navigate('/filtros?featured=1');
            break;
          case 'kit':
            navigate('/filtros?isKit=1');
            break;
        }
      },
      [onStatusClick, navigate],
    );

    const markBusy = () => {
      actionBusyRef.current = true;
      setTimeout(() => {
        actionBusyRef.current = false;
      }, 500);
    };

    const handleVariantComplete = useCallback(
      (variant: ExternalVariantStock | null) => {
        const variantInfo = variant
          ? {
              color_name: variant.color_name,
              color_hex: variant.color_hex,
              size_code: variant.size_code,
              variant_id: variant.id,
              thumbnail: variant.selected_thumbnail,
            }
          : undefined;

        if (variantPickerMode === 'favorite') {
          favStore.addFavorite(product.id, variantInfo);
          toast.success(
            `"${product.name}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
          );
        } else if (variantPickerMode === 'compare') {
          const result = compStore.addToCompare(product.id, variantInfo);
          if (!result) {
            showErrorToast({ title: 'Limite de 4 produtos para comparação atingido' });
          } else {
            toast.success(
              `"${product.name}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
            );
          }
        } else if (variantPickerMode === 'collection') {
          setCollectionVariant(variantInfo);
          setCollectionModalOpen(true);
        } else if (variantPickerMode === 'quote') {
          // Fluxo: variação já escolhida → seletor de cliente/carrinho.
          // Sempre abre o seletor (mesmo com 0/1 carrinho) para permitir criar carrinho
          // para outro cliente naquele momento.
          setPendingVariant(variant);
          if (carts.length === 0) {
            setCompanyPickerOpen(true);
          } else {
            setSelectorOpen(true);
          }
        } else if (variantPickerMode === 'share') {
          setShareVariant(
            variant
              ? {
                  variantName: variant.color_name,
                  colorHex: variant.color_hex,
                  thumbnailUrl: variant.selected_thumbnail,
                }
              : null,
          );
          setShareDialogOpen(true);
        }
      },
      [variantPickerMode, product, favStore, compStore, carts],
    );

    const formatPrice = (price: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

    const getStockColor = (status: string) => {
      switch (status) {
        case 'in-stock':
          return 'text-success';
        case 'low-stock':
          return 'text-warning';
        case 'out-of-stock':
          return 'text-destructive';
        default:
          return 'text-success';
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        actionBusyRef.current ||
        variantPickerOpen ||
        collectionModalOpen ||
        quickViewOpen ||
        shareDialogOpen
      )
        return;

      // Use provided onClick if available, otherwise default to navigation
      if (onClick) {
        onClick();
        return;
      }

      // Default navigation: When a specific color variant is active (from carousel/filter), navigate with color param
      if (currentVariant?.name) {
        const params = new URLSearchParams();
        params.set('cor', currentVariant.name);
        if (currentVariant.groupSlug) params.set('grupo', currentVariant.groupSlug);
        if (currentVariant.hex) params.set('hex', currentVariant.hex);
        navigate(`/produto/${product.id}?${params.toString()}`);
      } else if (onView) {
        onView(product);
      } else {
        navigate(`/produto/${product.id}`);
      }
    };

    const handleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      markBusy();
      if (isFavorited) {
        if (onToggleFavorite) {
          onToggleFavorite(product.id);
          showUndoToast({
            title: `"${product.name}" removido dos favoritos`,
            onUndo: () => onToggleFavorite(product.id),
          });
        }
      } else {
        setVariantPickerMode('favorite');
        setVariantPickerOpen(true);
      }
    };

    const handleCompare = (e: React.MouseEvent) => {
      e.stopPropagation();
      markBusy();
      if (isInCompare) {
        if (onToggleCompare) {
          onToggleCompare(product.id);
          showUndoToast({
            title: `"${product.name}" removido da comparação`,
            onUndo: () => onToggleCompare(product.id),
          });
        }
      } else {
        setVariantPickerMode('compare');
        setVariantPickerOpen(true);
      }
    };

    // Multi-variant carousel
    const allMatchingVariants = resolveAllMatchingColors(product.colors, activeColorFilter);
    const hasMultipleVariants = allMatchingVariants.length > 1;
    const safeVariantIdx = hasMultipleVariants
      ? Math.min(activeVariantIdx, allMatchingVariants.length - 1)
      : 0;
    const currentVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;

    // Match do swatch clicado pelo usuário (prioridade máxima sobre filtro/carousel)
    const userSelectedColor = userSelectedColorName
      ? (product.colors?.find(
          (c) => c.name.toLowerCase() === userSelectedColorName.toLowerCase(),
        ) ?? null)
      : null;
    const userSelectedImage =
      userSelectedColor?.images?.[0] || userSelectedColor?.image || undefined;

    const variantImage = userSelectedImage || currentVariant?.image;
    const colorSpecificImage = variantImage || resolveColorImage(product, activeColorFilter);
    // primary_image_url (is_primary=true) é a imagem capa canônica — deve ser a primeira exibida
    const rawImageUrl =
      colorSpecificImage ||
      product.primary_image_url ||
      product.og_image_url ||
      product.images[0] ||
      null;
    const thumbUrl = rawImageUrl ? getCdnUrl(rawImageUrl, 'card') : '/placeholder.svg';

    const colorStock = resolveColorStock(product, activeColorFilter, userSelectedColorName);
    // Estoque por cor resolvido pela fonte única (resolveColorStock já considera a cor selecionada pelo usuário via userSelectedColorName).
    const displayStock = colorStock?.stock ?? product.stock;
    const displayStatus = colorStock?.stockStatus ?? product.stockStatus;

    const activeColorName =
      userSelectedColor?.name ||
      currentVariant?.name ||
      getActiveColorName(product, activeColorFilter);

    const matchedHighlightColor =
      currentVariant?.hex ||
      resolveHighlightHex(product.colors, activeColorFilter, highlightColors);

    const hasColorMatch =
      !!matchedHighlightColor ||
      (highlightColors.length > 0 &&
        product.colors.some((c) => highlightColors.includes(c.group))) ||
      !!activeColorName;

    return (
      <>
        <article
          className={cn(
            'group relative flex min-h-[72px] items-start gap-2 px-3 py-2 sm:min-h-[96px] sm:gap-2.5 sm:px-4 sm:py-2.5 md:items-center',
            'cursor-pointer rounded-xl bg-card',
            'transition-all duration-200 ease-out',
            'touch-manipulation active:scale-[0.997]',
            hasColorMatch && matchedHighlightColor
              ? 'border-2'
              : 'border border-border/50 hover:border-primary/30 hover:bg-accent/30 hover:shadow-md',
          )}
          style={
            hasColorMatch && matchedHighlightColor
              ? ({
                  borderColor: `${matchedHighlightColor}70`,
                  boxShadow: `inset 0 0 30px -6px ${matchedHighlightColor}40, 0 0 8px -2px ${matchedHighlightColor}20`,
                } as React.CSSProperties)
              : undefined
          }
          onClick={handleClick}
        >
          {/* Thumbnail — compact square */}
          <div
            ref={quickViewTriggerRef}
            className="group/thumb relative h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-border/30 bg-muted/30 outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-[72px] sm:w-[72px]"
            role="button"
            tabIndex={0}
            aria-label={`Visualização rápida de ${product.name}`}
            aria-haspopup="dialog"
            aria-expanded={quickViewOpen}
            data-testid="product-list-item-thumb"
            data-product-id={product.id}
            style={{ touchAction: 'manipulation' }}
            onClick={(e) => {
              e.stopPropagation();
              if (
                actionBusyRef.current ||
                variantPickerOpen ||
                collectionModalOpen ||
                shareDialogOpen ||
                quickViewOpen
              ) {
                return;
              }
              setQuickViewOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (
                  actionBusyRef.current ||
                  variantPickerOpen ||
                  collectionModalOpen ||
                  shareDialogOpen ||
                  quickViewOpen
                ) {
                  return;
                }
                setQuickViewOpen(true);
              }
            }}
          >
            <div key={thumbUrl} className="h-full w-full duration-500 animate-in fade-in">
              <OptimizedImage
                src={thumbUrl}
                alt={product.name}
                className="object-contain transition-transform duration-300 group-hover/thumb:scale-105"
                containerClassName="h-full w-full"
                urlOriginal={product.images?.[0]}
                priority={priority}
              />
            </div>
            {/* Multi-variant dots */}
            {hasMultipleVariants && (
              <div
                role="tablist"
                aria-label="Variantes de cor"
                className="absolute bottom-0.5 left-0 right-0 z-10 flex justify-center gap-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setActiveVariantIdx((safeVariantIdx + 1) % allMatchingVariants.length);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setActiveVariantIdx(
                      (safeVariantIdx - 1 + allMatchingVariants.length) %
                        allMatchingVariants.length,
                    );
                  }
                }}
              >
                {allMatchingVariants.map((v, i) => (
                  <Tooltip key={`${v.groupSlug}-${v.variationSlug}-${v.name}`}>
                    <TooltipTrigger asChild>
                      <button
                        role="tab"
                        type="button"
                        tabIndex={i === safeVariantIdx ? 0 : -1}
                        aria-selected={i === safeVariantIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveVariantIdx(i);
                        }}
                        className={cn(
                          'h-3 w-3 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          i === safeVariantIdx
                            ? 'scale-110 ring-1 ring-offset-1 ring-offset-card'
                            : 'border-border/50 opacity-60',
                        )}
                        style={{
                          backgroundColor: v.hex,
                          borderColor:
                            i === safeVariantIdx
                              ? isLightColor(v.hex)
                                ? 'hsl(var(--muted-foreground))'
                                : v.hex
                              : undefined,
                          ['--tw-ring-color' as string]:
                            i === safeVariantIdx
                              ? isLightColor(v.hex)
                                ? 'hsl(var(--muted-foreground) / 0.6)'
                                : v.hex
                              : v.hex,
                        }}
                        aria-label={`Ver ${v.name}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className={colorTooltipClassName}>
                      <ColorTooltipContent colorName={v.name} colorHex={v.hex} />
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          {/* Info — main content block */}
          <div className="min-w-0 flex-1 py-0.5 md:max-w-[34%] md:flex-[0_1_34%]">
            {/* Top meta row */}
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
              {product.featured && (
                <ProductStatusBadge
                  type="featured"
                  size="sm"
                  onClick={() => handleStatusClick('featured')}
                />
              )}
              {isNovelty && noveltyDaysRemaining !== undefined && (
                <NoveltyBadge
                  daysRemaining={noveltyDaysRemaining}
                  daysElapsed={noveltyDaysElapsed}
                  size="sm"
                  onClick={() => handleStatusClick('novelty')}
                />
              )}
              {product.onSale && (
                <ProductStatusBadge
                  type="promotion"
                  size="sm"
                  onClick={() => handleStatusClick('promotion')}
                />
              )}
              {detectedIsKit && (
                <ProductStatusBadge type="kit" size="sm" onClick={() => handleStatusClick('kit')} />
              )}
              {product.hasCommercialPackaging && (
                <ProductStatusBadge
                  type="packaging"
                  size="sm"
                  value="Embalagem"
                  packagingMetadata={{
                    packingType: product.packingType,
                    boxWidthMm: product.boxWidthMm,
                    boxHeightMm: product.boxHeightMm,
                    boxLengthMm: product.boxLengthMm,
                    packagingContext: product.packagingContext,
                  }}
                  onClick={() => handleStatusClick('packaging')}
                />
              )}
              <span className="max-w-[120px] truncate">
                {product.category?.name || 'Sem categoria'}
              </span>
              <span className="text-border">•</span>
              <span
                className={cn(
                  'flex shrink-0 items-center gap-0.5',
                  getSupplierColors(product.supplier.name).text,
                )}
              >
                <Building2 className="h-2.5 w-2.5" />
                <span className="max-w-[80px] truncate">{product.supplier.name}</span>
              </span>
              <GenderBadge gender={product.gender} size="sm" />
            </div>

            {/* Product name */}
            <h3
              data-testid="product-list-name"
              className="line-clamp-2 break-words font-display text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-[15px]"
            >
              {product.name}
            </h3>

            {/* Active color badge */}
            {activeColorName && (
              <Badge
                variant="outline"
                className="mt-0.5 h-4 w-fit border-primary/30 px-1.5 py-0 text-[9px] text-primary/80"
              >
                {activeColorName}
              </Badge>
            )}

            {/* SKU + Stock row (estoque inline só no mobile; em md+ vira coluna própria) */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {product.sku && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide text-primary sm:text-xs">
                  {product.sku}
                </span>
              )}
              <span
                className={cn(
                  'flex items-center gap-1 text-[10px] font-medium md:hidden',
                  getStockColor(displayStatus),
                )}
                aria-label={`Estoque: ${displayStock.toLocaleString('pt-BR')} unidades`}
              >
                <Package className="h-2.5 w-2.5" aria-hidden="true" />
                {displayStock.toLocaleString('pt-BR')} Unid
              </span>
            </div>
          </div>

          {/* Estoque column — entre Produto e Cores (md+) */}
          <div
            role="group"
            aria-labelledby={stockLabelId}
            className="-ml-1 hidden shrink-0 flex-col items-start justify-center md:flex md:w-[140px]"
          >
            <span
              id={stockLabelId}
              className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Estoque
            </span>
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium sm:text-xs',
                getStockColor(displayStatus),
              )}
            >
              <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
              <span className="whitespace-nowrap">{displayStock.toLocaleString('pt-BR')} Unid</span>
            </span>
          </div>

          {/* Cores column — todas as cores, sem clipping (md+) */}
          <div
            role="group"
            aria-labelledby={colorsLabelId}
            className="hidden min-w-0 flex-1 flex-col items-start justify-center pl-1 pr-2 md:flex"
          >
            <span
              id={colorsLabelId}
              className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              Cores
            </span>
            {/*
              Cap visual: até 3 linhas em md (telas estreitas), 2 linhas em lg+.
              Respiro de 6px acomoda ring-offset-1 + shadow 12px do swatch selecionado
              sem cortar o glow.
            */}
            <div
              className="w-full overflow-hidden md:[--swatch-rows:3] lg:[--swatch-rows:2]"
              style={{
                maxHeight:
                  'calc(var(--swatch-size-sm) * var(--swatch-rows, 2) + var(--swatch-gap-y) * (var(--swatch-rows, 2) - 1) + var(--swatch-container-py) * 2 + 6px)',
              }}
            >
              <ProductColorSwatches
                colors={product.colors}
                max={product.colors?.length || 0}
                size="sm"
                wrap
                hideWhenEmpty
                className="justify-start"
                selectedName={activeColorName}
                onSelect={(c) => {
                  setUserSelectedColorName((prev) =>
                    prev?.toLowerCase() === c.name.toLowerCase() ? null : c.name,
                  );
                }}
                onClear={() => setUserSelectedColorName(null)}
              />
            </div>
          </div>

          {/* Price column — right-aligned, always visible */}
          <div
            role="group"
            aria-labelledby={priceLabelId}
            className="flex min-w-[90px] shrink-0 flex-col items-end text-right sm:min-w-[110px]"
          >
            <span
              id={priceLabelId}
              className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80"
            >
              A partir de
            </span>
            <div className="flex items-center justify-end gap-1.5">
              <PriceFreshnessBadge
                priceUpdatedAt={product.priceUpdatedAt}
                thresholdDays={product.priceFreshnessThresholdDays}
                variant="icon-only"
              />
              <span className="whitespace-nowrap font-display text-base font-bold text-foreground sm:text-lg">
                {formatPrice(product.price)}
              </span>
            </div>
          </div>

          <ListItemActions
            product={product}
            isFavorited={isFavorited}
            isInCompare={isInCompare}
            canAddToCompare={canAddToCompare}
            onFavorite={handleFavorite}
            onCompare={handleCompare}
            onVariantAction={(mode, e) => {
              e.stopPropagation();
              markBusy();
              setVariantPickerMode(mode);
              setVariantPickerOpen(true);
            }}
            onQuickView={(e) => {
              e.stopPropagation();
              markBusy();
              setQuickViewOpen(true);
            }}
          />
        </article>

        {/* Variant Picker Dialog */}
        <VariantPickerDialog
          open={variantPickerOpen}
          onOpenChange={setVariantPickerOpen}
          productId={product.id}
          productName={product.name}
          mode={variantPickerMode}
          onComplete={handleVariantComplete}
        />

        {/* Collection Modal */}
        <AddToCollectionModal
          open={collectionModalOpen}
          onOpenChange={setCollectionModalOpen}
          productId={product.id}
          productName={product.name}
          variant={collectionVariant}
        />

        {/* Quick View Modal */}
        <ProductQuickView
          product={product}
          open={quickViewOpen}
          onOpenChange={(open) => {
            setQuickViewOpen(open);
            if (!open) {
              requestAnimationFrame(() => {
                quickViewTriggerRef.current?.focus({ preventScroll: true });
              });
            }
          }}
          isFavorited={isFavorited}
          onToggleFavorite={onToggleFavorite}
          isInCompare={isInCompare}
          onToggleCompare={onToggleCompare}
          onShare={onShare}
          onAddToQuote={() => {
            setVariantPickerMode('quote');
            setVariantPickerOpen(true);
          }}
          onAddToCollection={() => {
            setVariantPickerMode('collection');
            setVariantPickerOpen(true);
          }}
        />

        {/* Share Preview Dialog */}
        <SharePreviewDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          product={product}
          selectedVariant={shareVariant}
        />

        {/* Cart/Cliente Selector — exibido após a escolha da variação */}
        <CartSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          carts={carts}
          productName={product.name}
          canCreateMore={canCreateCart}
          onSelect={(cartId) => {
            addToActiveCart(
              {
                product_id: product.id,
                product_name: product.name,
                product_sku: product.sku || undefined,
                product_image_url: pendingVariant?.selected_thumbnail || product.images?.[0],
                product_price: product.price ?? 0,
                quantity: product.minQuantity || 1,
                color_name: pendingVariant?.color_name || undefined,
                color_hex: pendingVariant?.color_hex || undefined,
              },
              cartId,
            );
            setSelectorOpen(false);
            setPendingVariant(null);
          }}
          onCreateNew={() => {
            // Mantém pendingVariant — será adicionado ao carrinho recém-criado
            setSelectorOpen(false);
            setCompanyPickerOpen(true);
          }}
        />

        {/* Picker de empresa — cria carrinho na hora para outro cliente e adiciona o item */}
        <CartCompanyPickerDialog
          open={companyPickerOpen}
          onOpenChange={(o) => {
            setCompanyPickerOpen(o);
            if (!o) setPendingVariant(null);
          }}
          onCreated={(newCartId) => {
            if (newCartId) {
              addToActiveCart(
                {
                  product_id: product.id,
                  product_name: product.name,
                  product_sku: product.sku || undefined,
                  product_image_url: pendingVariant?.selected_thumbnail || product.images?.[0],
                  product_price: product.price ?? 0,
                  quantity: product.minQuantity || 1,
                  color_name: pendingVariant?.color_name || undefined,
                  color_hex: pendingVariant?.color_hex || undefined,
                },
                newCartId,
              );
            }
            setPendingVariant(null);
          }}
        />
      </>
    );
  },
);

ProductListItem.displayName = 'ProductListItem';
