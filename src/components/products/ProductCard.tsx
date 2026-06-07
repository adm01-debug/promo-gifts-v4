/**
 * ProductCard — Main catalog card component.
 * Refactored: image section in ProductCardImage, FAB actions in ProductCardActions.
 */
import { useState, useRef, useEffect, useMemo, memo, forwardRef, useCallback } from 'react';
import { GenderBadge } from './GenderBadge';
import { Building2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCdnUrl, getSrcSet } from '@/utils/image-utils';
import { cn } from '@/lib/utils';
import { useProductBounds } from '@/hooks/products/useProductBounds';
import { usePrefetchProduct } from '@/hooks/products/usePrefetchProduct';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import type { Product } from '@/types/product-catalog';
import { toast } from 'sonner';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { ProductQuickView } from './ProductQuickView';
import { ProductCategoryBadges } from './ProductCategoryBadges';
import { useLeafCategory } from '@/hooks/products/useProductLeafCategories';
import { showUndoToast, showErrorToast } from '@/utils/undoToast';
import { getSupplierColors } from '@/lib/supplier-colors';
import {
  resolveColorImage,
  resolveColorStock,
  getActiveColorName,
  type ActiveColorFilter,
} from '@/utils/color-image-resolver';
import { resolveHighlightHex } from '@/utils/color-group-hex';
import { resolveAllMatchingColors } from '@/utils/color-variant-carousel';
import { ProductSparkline } from './ProductSparkline';
import { VariantPickerDialog, type VariantActionMode } from './VariantPickerDialog';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { SharePreviewDialog } from './share/SharePreviewDialog';
import { ProductCardImage } from './ProductCardImage';
import { ProductCardActions } from './ProductCardActions';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { ProductColorSwatches } from './ProductColorSwatches';
import { feedback } from '@/lib/feedback';
import { telemetryService } from '@/services/telemetryService';
import { useProductSelectionStore } from '@/stores/useProductSelectionStore';

const priceFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPrice = (price: number) => priceFormatter.format(price);

const STOCK_STATUS_COLOR: Record<string, string> = {
  'in-stock': 'in-stock',
  'low-stock': 'low-stock',
  'out-of-stock': 'out-of-stock',
};
const getStockStatusColor = (status: string) => STOCK_STATUS_COLOR[status] ?? 'in-stock';

const STOCK_STATUS_LABEL: Record<string, string> = {
  'in-stock': 'Em estoque',
  'low-stock': 'Estoque baixo',
  'out-of-stock': 'Sem estoque',
};
const getStockStatusLabel = (status: string) => STOCK_STATUS_LABEL[status] ?? 'Em estoque';

export interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  onView?: (product: Product) => void;
  onShare?: (product: Product) => void;
  onFavorite?: (product: Product) => void;
  highlightColors?: string[];
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string) => void;
  isInCompare?: boolean;
  onToggleCompare?: (productId: string) => { added: boolean; isFull: boolean };
  canAddToCompare?: boolean;
  hideCategoryBadges?: boolean;
  isNovelty?: boolean;
  noveltyDaysRemaining?: number;
  activeColorFilter?: ActiveColorFilter | null;
  priority?: boolean;
  onStatusClick?: (type: string, value?: string | number) => void;
}

export const ProductCard = memo(
  forwardRef<HTMLElement, ProductCardProps>(function ProductCard(
    {
      product,
      onClick,
      onView: _onView,
      onShare,
      onFavorite: _onFavorite,
      highlightColors,
      isFavorited = false,
      onToggleFavorite,
      isInCompare = false,
      onToggleCompare,
      canAddToCompare = true,
      hideCategoryBadges = false,
      isNovelty = false,
      noveltyDaysRemaining,
      activeColorFilter,
      priority = false,
      onStatusClick,
    },
    ref,
  ) {
    const navigate = useNavigate();
    const { prefetchProduct } = usePrefetchProduct();
    const leafCategory = useLeafCategory(product.id);
    const [isHovered, setIsHovered] = useState(false);
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
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareVariant, setShareVariant] = useState<{
      variantName?: string | null;
      colorHex?: string | null;
      thumbnailUrl?: string | null;
    } | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [activeVariantIdx, setActiveVariantIdx] = useState(0);
    const [isUpdatingColor, setIsUpdatingColor] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Efeito para simular loading ao trocar de cor
    useEffect(() => {
      // Pequeno delay para evitar flickering visual e mostrar skeleton de carregamento
      setIsUpdatingColor(true);
      const timer = setTimeout(() => setIsUpdatingColor(false), 350);
      return () => clearTimeout(timer);
    }, [activeVariantIdx]);

    const filterKey = activeColorFilter
      ? `${(activeColorFilter.groups || []).join(',')}|${(activeColorFilter.variations || []).join(',')}`
      : '';
    const prevFilterKeyRef = useRef(filterKey);
    useEffect(() => {
      if (prevFilterKeyRef.current !== filterKey) {
        setActiveVariantIdx(0);
        prevFilterKeyRef.current = filterKey;
      }
    }, [filterKey]);

    // BUG-4 FIX: Sincronização de cor selecionada entre Grid e PDP via store
    const setSelectedColor = useProductSelectionStore((s) => s.setSelectedColor);
    const selectedColorFromStore = useProductSelectionStore((s) => s.selectedColors[product.id]);

    // TDZ FIX: `allMatchingVariants` antes era declarado na linha ~298, depois
    // do useEffect abaixo que o referencia no array de deps — isso quebrava em
    // runtime com "Cannot access 'allMatchingVariants' before initialization"
    // (TDZ de const em mesma scope). Move-se a derivação para cá, antes do
    // primeiro uso.
    const allMatchingVariants = useMemo(() => {
      const matches = resolveAllMatchingColors(product.colors, activeColorFilter);
      // Se não houver filtros ativos, todas as cores do produto são consideradas para o carrossel
      if (matches.length === 0 && product.colors) {
        return product.colors.map((c) => ({
          name: c.name,
          hex: c.hex || '#888',
          image: c.images?.[0] || c.image,
          groupSlug: c.groupSlug,
          variationSlug: c.variationSlug,
        }));
      }
      return matches;
    }, [product.colors, activeColorFilter]);

    useEffect(() => {
      setIsInitialLoad(false);
    }, []);

    useEffect(() => {
      if (product.colors && product.colors.length > 0) {
        // Resolve URL param de forma estável
        const urlParams =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const urlColor = urlParams?.get('cor');
        const urlProductId = urlParams?.get('pid');

        // Prioridade: URL (se o pid coincidir) > Seleção manual > Filtro ativo
        const targetColor =
          (urlProductId === product.id ? urlColor : null) ||
          selectedColorFromStore ||
          getActiveColorName(product, activeColorFilter);

        if (targetColor) {
          const idx = allMatchingVariants.findIndex(
            (v) => v.name?.toLowerCase() === targetColor.toLowerCase(),
          );
          // BUG-INF-LOOP: Avoid setting state if it's already the current value
          if (idx >= 0 && idx !== activeVariantIdx) {
            setActiveVariantIdx(idx);
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- granular deps (product.id, product.colors) intentionally preferred over `product` to avoid spurious re-runs
    }, [
      product.id,
      product.colors,
      selectedColorFromStore,
      activeColorFilter,
      allMatchingVariants,
      activeVariantIdx,
    ]);

    const actionBusyRef = useRef(false);
    const [variantPickerOpen, setVariantPickerOpen] = useState(false);
    const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');

    const addFavorite = useFavoritesStore((s) => s.addFavorite);
    const addToCompare = useComparisonStore((s) => s.addToCompare);

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
          case 'packaging':
            navigate('/filtros?hasCommercialPackaging=1');
            break;
        }
      },
      [onStatusClick, navigate],
    );

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
          addFavorite(product.id, variantInfo);
          feedback.light();
          toast.success(
            `"${product.name}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
          );
        } else if (variantPickerMode === 'compare') {
          const result = addToCompare(product.id, variantInfo);
          if (!result) {
            feedback.error();
            showErrorToast({ title: 'Limite de 4 produtos para comparação atingido' });
          } else {
            feedback.light();
            toast.success(
              `"${product.name}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
            );
          }
        } else if (variantPickerMode === 'collection') {
          setCollectionVariant(variantInfo);
          setCollectionModalOpen(true);
        } else if (variantPickerMode === 'quote') {
          const params = new URLSearchParams({
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku || '',
            product_price: String(product.price ?? 0),
          });
          if (variant?.color_name) params.set('color_name', variant.color_name);
          if (variant?.color_hex) params.set('color_hex', variant.color_hex);
          if (variant?.selected_thumbnail) params.set('product_image', variant.selected_thumbnail);
          if (product.images?.[0])
            params.set('product_image', variant?.selected_thumbnail || product.images[0]);
          setTimeout(() => navigate(`/orcamentos/novo?${params.toString()}`), 0);
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
      [variantPickerMode, product, addFavorite, addToCompare, navigate],
    );

    const markBusy = () => {
      actionBusyRef.current = true;
      setTimeout(() => {
        actionBusyRef.current = false;
      }, 500);
    };

    const handleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      markBusy();
      setActionsOpen(false);
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
      setActionsOpen(false);
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

    // Multi-variant carousel — `allMatchingVariants` é derivado acima
    // (TDZ FIX: precisa estar antes do primeiro useEffect que o consome).
    const hasMultipleVariants = allMatchingVariants.length > 1;
    const safeVariantIdx = hasMultipleVariants
      ? Math.min(activeVariantIdx, allMatchingVariants.length - 1)
      : 0;
    const currentVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;
    const matchedHighlightColor =
      currentVariant?.hex ||
      resolveHighlightHex(product.colors, activeColorFilter, highlightColors);
    const _hasHighlightedColor = !!matchedHighlightColor;

    const activeColorName = currentVariant?.name || getActiveColorName(product, activeColorFilter);
    const _activeColorHex = currentVariant?.hex || null;

    // Se houver uma cor ativa (selecionada ou filtrada), forçamos a imagem dessa cor
    const currentImageUrl = useMemo(() => {
      // Prioridade 1: Imagem da variante atual do carrossel/seleção
      if (currentVariant?.image) return currentVariant.image;

      // Prioridade 2: Resolver por filtro de cor (se houver)
      const filteredImg = resolveColorImage(product, activeColorFilter);
      if (filteredImg) return filteredImg;

      // Prioridade 3: Se tivermos apenas o nome da cor (ex: seleção manual via swatch)
      if (activeColorName) {
        const colorMatch = product.colors?.find(
          (c) => c.name.toLowerCase() === activeColorName.toLowerCase(),
        );
        const matchedImg = colorMatch ? colorMatch.images?.[0] || colorMatch.image : null;
        if (matchedImg) return matchedImg;
      }

      // Fallback
      return product.og_image_url || product.images[0] || null;
    }, [product, activeColorFilter, currentVariant, activeColorName]);

    // Caso de fallback para quando a imagem da cor não existe
    const effectiveImageUrl = currentImageUrl || '/placeholder.svg';

    const cardImageUrl =
      effectiveImageUrl !== '/placeholder.svg'
        ? getCdnUrl(effectiveImageUrl, 'card')
        : '/placeholder.svg';
    const _hasNoImage = effectiveImageUrl === '/placeholder.svg';

    const cardSrcSet =
      effectiveImageUrl !== '/placeholder.svg' &&
      (effectiveImageUrl === product.og_image_url || effectiveImageUrl === product.images[0])
        ? getSrcSet(effectiveImageUrl)
        : undefined;

    const colorSpecificImage = effectiveImageUrl;

    const imageBounds = useProductBounds(
      cardImageUrl !== '/placeholder.svg' ? cardImageUrl : null,
      { whiteThreshold: 230, margin: 0.01, maxSize: 384 },
    );
    const isOversizedImage =
      imageBounds.detected && imageBounds.fractionX >= 0.86 && imageBounds.fractionY >= 0.86;
    const computedImageScale = Number(
      ((isOversizedImage ? 0.88 : 1) * (isHovered ? 1.03 : 1)).toFixed(3),
    );

    return (
      <article
        ref={ref}
        data-testid="product-card"
        data-product-id={product.id}
        className={cn(
          'card-lift card-glow group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl bg-card sm:rounded-2xl',
          'touch-manipulation transition-all duration-500 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          product.featured && 'shadow-lg ring-2 ring-primary/20',
        )}
        onMouseEnter={() => {
          setIsHovered(true);
          telemetryService.logUXAction('product_hover', {
            productId: product.id,
            name: product.name,
          });
          prefetchProduct(product.id);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setActionsOpen(false);
        }}
        aria-label={`Ver detalhes de ${product.name}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/produto/${product.id}`);
          } else if (e.key.toLowerCase() === 'q') {
            e.preventDefault();
            setQuickViewOpen(true);
          }
        }}
        onClick={(e) => {
          if (
            actionsOpen ||
            actionBusyRef.current ||
            variantPickerOpen ||
            collectionModalOpen ||
            quickViewOpen
          ) {
            e.stopPropagation();
            return;
          }

          if (onClick) {
            onClick();
            return;
          }

          if (currentVariant?.name) {
            const params = new URLSearchParams();
            params.set('cor', currentVariant.name);
            if (currentVariant.groupSlug) params.set('grupo', currentVariant.groupSlug);
            if (currentVariant.hex) params.set('hex', currentVariant.hex.replace('#', ''));
            navigate(`/produto/${product.id}?${params.toString()}`);
          } else {
            navigate(`/produto/${product.id}`);
          }
        }}
      >
        {/* Image Section */}
        <ProductCardImage
          product={product}
          cardImageUrl={cardImageUrl}
          cardSrcSet={cardSrcSet}
          activeColorName={activeColorName ?? null}
          colorSpecificImage={colorSpecificImage ?? null}
          imageLoaded={imageLoaded}
          isHovered={isHovered}
          computedImageScale={computedImageScale}
          isNovelty={isNovelty}
          noveltyDaysRemaining={noveltyDaysRemaining}
          highlightColors={highlightColors}
          activeColorFilter={activeColorFilter}
          allMatchingVariants={allMatchingVariants}
          hasMultipleVariants={hasMultipleVariants}
          safeVariantIdx={safeVariantIdx}
          onImageLoad={() => setImageLoaded(true)}
          onVariantChange={(idx) => {
            setActiveVariantIdx(idx);
            setImageLoaded(false);
          }}
          priority={priority}
          onStatusClick={handleStatusClick}
          isUpdatingColor={isUpdatingColor}
        />

        {/* Quick Actions FAB */}
        {(() => {
          const colorStock = resolveColorStock(product, activeColorFilter, activeColorName);
          const isOutOfStock = (colorStock?.stockStatus ?? product.stockStatus) === 'out-of-stock';

          return (
            <ProductCardActions
              productId={product.id}
              productName={product.name}
              productSku={product.sku}
              productImageUrl={product.og_image_url || product.images[0]}
              productPrice={product.price}
              productMinQuantity={product.minQuantity || 1}
              isFavorited={isFavorited}
              isInCompare={isInCompare}
              canAddToCompare={canAddToCompare}
              actionsOpen={actionsOpen}
              isOutOfStock={isOutOfStock}
              onToggleActions={() => setActionsOpen(!actionsOpen)}
              onFavorite={handleFavorite}
              onCompare={handleCompare}
              onOpenVariantPicker={(mode) => {
                setActionsOpen(false);
                setVariantPickerMode(mode);
                setVariantPickerOpen(true);
              }}
              onQuickView={() => {
                setActionsOpen(false);
                setQuickViewOpen(true);
              }}
              markBusy={markBusy}
            />
          );
        })()}

        {/* Info section */}
        <div
          className={cn(
            'relative flex flex-1 flex-col space-y-2.5 p-3 transition-all duration-500 sm:space-y-4 sm:p-5',
            isHovered ? 'translate-y-[-2px] bg-background' : 'bg-background',
          )}
          style={{ zIndex: 10 }}
        >
          {!hideCategoryBadges && (
            <ProductCategoryBadges
              category={
                leafCategory ? { id: leafCategory.id, name: leafCategory.name } : product.category
              }
              groups={product.groups}
              categoryUuid={leafCategory?.id ?? product.category_id}
              categoryPath={leafCategory?.path}
              className="flex-wrap"
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-tighter text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 sm:text-xs">
              {product.sku}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <GenderBadge gender={product.gender} size="sm" />
              <span className="flex max-w-[120px] items-center gap-1.5 truncate rounded-lg border border-border/20 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">
                <Building2
                  className={cn('h-3 w-3 shrink-0', getSupplierColors(product.supplier.name).text)}
                />
                {product.supplier.name}
              </span>
            </div>
          </div>

          <h3
            data-testid="product-card-name"
            data-product-name={product.name}
            className="line-clamp-2 max-h-[2.4rem] min-h-[2.4rem] font-display text-[11.2px] font-bold leading-tight tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary sm:max-h-[2.8rem] sm:min-h-[2.8rem] sm:text-[12.8px]"
          >
            {product.name}
          </h3>

          <ProductColorSwatches
            colors={product.colors?.map((c) => ({ name: c.name, hex: c.hex ?? null }))}
            max={6}
            size="sm"
            hideWhenEmpty={false}
            selectedName={activeColorName ?? null}
            onSelect={(c) => {
              const idx = allMatchingVariants.findIndex(
                (v) => v.name?.toLowerCase() === c.name.toLowerCase(),
              );
              if (idx >= 0) {
                // Efeito visual de destaque ao clicar
                feedback.light();
                setActiveVariantIdx(idx);
                setSelectedColor(product.id, c.name);
                setImageLoaded(false);

                // Persiste a cor na URL sem forçar navegação completa
                const currentUrl = new URL(window.location.href);
                currentUrl.searchParams.set('cor', c.name);
                window.history.replaceState({}, '', currentUrl.toString());
              }
            }}
          />

          <div className="flex-1" />

          {(() => {
            const colorStock = resolveColorStock(product, activeColorFilter, activeColorName);
            const displayStock = colorStock?.stock ?? product.stock;
            const displayStatus = colorStock?.stockStatus ?? product.stockStatus;

            return (
              <div
                key={activeColorName || 'default'}
                className={cn(
                  'flex items-end justify-between pt-0.5 transition-all duration-500 sm:pt-1',
                  !isInitialLoad && isUpdatingColor
                    ? 'translate-y-2 opacity-0'
                    : 'translate-y-0 opacity-100 animate-in fade-in slide-in-from-bottom-1',
                )}
              >
                <div>
                  <p className="mb-0.5 text-[10px] font-medium text-muted-foreground opacity-70 sm:text-[11px]">
                    {activeColorName || 'A partir de'}
                  </p>
                  <span className="inline-flex items-center gap-2 font-display text-xs font-black tracking-tight text-foreground sm:text-lg">
                    {formatPrice(product.price)}
                    <PriceFreshnessBadge
                      priceUpdatedAt={product.priceUpdatedAt}
                      thresholdDays={product.priceFreshnessThresholdDays}
                      variant="icon-only"
                    />
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                  <span
                    className={cn(
                      'stock-indicator flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight sm:text-[10px]',
                      displayStatus === 'out-of-stock'
                        ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                        : getStockStatusColor(displayStatus),
                    )}
                  >
                    <Package className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
                    <span className="whitespace-nowrap">{getStockStatusLabel(displayStatus)}</span>
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                    {(displayStock ?? 0).toLocaleString('pt-BR')} un.
                  </span>
                </div>
              </div>
            );
          })()}

          {Array.isArray(product.materials) && product.materials.length > 0 && (
            <div className="hidden flex-wrap gap-1.5 border-t border-border/50 pt-2 sm:flex">
              {product.materials.slice(0, 2).map((material) => (
                <span
                  key={material}
                  className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {material}
                </span>
              ))}
              {product.materials.length > 2 && (
                <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  +{product.materials.length - 2}
                </span>
              )}
            </div>
          )}

          <div className="border-t border-border/30 pt-1.5 sm:pt-2">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                Vendas 30d
              </span>
            </div>
            <ProductSparkline productId={product.id} />
          </div>
        </div>

        {/* Dialogs */}
        <VariantPickerDialog
          open={variantPickerOpen}
          onOpenChange={setVariantPickerOpen}
          productId={product.id}
          productName={product.name}
          mode={variantPickerMode}
          onComplete={handleVariantComplete}
        />
        <AddToCollectionModal
          open={collectionModalOpen}
          onOpenChange={setCollectionModalOpen}
          productId={product.id}
          productName={product.name}
          variant={collectionVariant}
        />
        <ProductQuickView
          product={product}
          open={quickViewOpen}
          onOpenChange={setQuickViewOpen}
          isFavorited={isFavorited}
          onToggleFavorite={onToggleFavorite}
          isInCompare={isInCompare}
          onToggleCompare={onToggleCompare}
          onShare={onShare}
        />
        <SharePreviewDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          product={product}
          selectedVariant={shareVariant}
        />
      </article>
    );
  }),
);

ProductCard.displayName = 'ProductCard';
