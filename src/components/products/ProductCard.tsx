/**
 * ProductCard — Main catalog card component.
 * Refactored: image section in ProductCardImage, FAB actions in ProductCardActions.
 */
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  memo,
  forwardRef,
  useCallback,
  lazy,
  Suspense,
} from 'react';
import { GenderBadge } from './GenderBadge';
import { Building2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCdnUrl, getSrcSet } from '@/utils/image-utils';
import { cn } from '@/lib/utils';
import { useProductBounds } from '@/hooks/products/useProductBounds';
import { usePrefetchProduct } from '@/hooks/products/usePrefetchProduct';
import {
  useExternalVariantStock,
  type ExternalVariantStock,
} from '@/hooks/products/useExternalVariantStock';
import type { Product } from '@/types/product-catalog';
import { toast } from 'sonner';
// ── Lazy dialog imports — carregados apenas na primeira abertura ──────────────
const AddToCollectionModal = lazy(() =>
  import('@/components/collections/AddToCollectionModal').then((m) => ({
    default: m.AddToCollectionModal,
  })),
);
const ProductQuickView = lazy(() =>
  import('./ProductQuickView').then((m) => ({ default: m.ProductQuickView })),
);
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
import { resolveAllMatchingColors } from '@/utils/color-variant-carousel';
import { ProductSales90dButton } from './ProductSales90dButton';
import type { VariantActionMode } from './VariantPickerDialog';
const VariantPickerDialog = lazy(() =>
  import('./VariantPickerDialog').then((m) => ({ default: m.VariantPickerDialog })),
);
const CartSelectorDialog = lazy(() =>
  import('@/components/cart/CartSelectorDialog').then((m) => ({ default: m.CartSelectorDialog })),
);
const CartCompanyPickerDialog = lazy(() =>
  import('@/components/cart/CartCompanyPickerDialog').then((m) => ({
    default: m.CartCompanyPickerDialog,
  })),
);
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
const SharePreviewDialog = lazy(() =>
  import('./share/SharePreviewDialog').then((m) => ({ default: m.SharePreviewDialog })),
);
import { ProductCardImage } from './ProductCardImage';
import { ProductCardActions } from './ProductCardActions';
import { PriceFreshnessBadge } from './PriceFreshnessBadge';
import { ProductColorSwatches } from './ProductColorSwatches';
import { isProductKit } from '@/lib/products/kit-detection';
import { useProductIntelligenceBadges } from '@/hooks/products/useProductIntelligenceBadges';
import { IntelligenceBadges } from '@/components/common/IntelligenceBadges';
import { feedback } from '@/lib/feedback';
import { telemetryService } from '@/services/telemetryService';
import { useProductSelectionStore } from '@/stores/useProductSelectionStore';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { useWordMagic } from '@/hooks/word-magic/useWordMagic';
import { WordMagicBadge } from '@/components/word-magic/WordMagicBadge';

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
  'out-of-stock': 'Estoque zerado',
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
  /**
   * FIX ISSUE-02 2026-06-09: Imagem real da variante de cor via useColorEnrichment (ProductGrid).
   * Injetada quando filtro de cor ativo no catálogo lightweight (batch colors = {name,hex} sem images[]).
   * Evita exibir primary_image_url genérica quando filtro de cor está ativo.
   */
  colorEnrichmentImage?: string | null;
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
      colorEnrichmentImage,
    },
    ref,
  ) {
    const navigate = useNavigate();
    const { prefetchProduct } = usePrefetchProduct();
    const leafCategory = useLeafCategory(product.id);
    const detectedIsKit = isProductKit(product, {
      categoryName: leafCategory?.name,
      categoryPath: leafCategory?.path,
    });
    const { badges: intelligenceBadges } = useProductIntelligenceBadges(product.id, {
      featured: product.featured,
      new_arrival: (product as { new_arrival?: boolean }).new_arrival,
    });
    const cardIntelligenceBadges = useMemo(
      () => intelligenceBadges.filter((b) => b.type === 'best-seller' || b.type === 'hot-item'),
      [intelligenceBadges],
    );
    const [isHovered, setIsHovered] = useState(false);
    // ── Dialog states agrupados — 1 re-render por abertura de dialog ─────────
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
      // Pequeno delay para evitar flickering visual e mostrar skeleton de carregamento.
      // 100ms é o suficiente para percepção de mudança sem parecer lento.
      setIsUpdatingColor(true);
      const timer = setTimeout(() => setIsUpdatingColor(false), 100);
      return () => clearTimeout(timer);
    }, [activeVariantIdx]);

    const filterKey = activeColorFilter
      ? `${(activeColorFilter.groups ?? []).join(',')}|${(activeColorFilter.variations ?? []).join(',')}`
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

    // Carrega variantes (com estoque/foto por cor) assim que o usuário interage com o card
    // — hover OU clique de cor — para evitar latência percebida no clique da bolinha.
    // Demais cards (sem hover/clique) não disparam request.
    const { data: liveVariants } = useExternalVariantStock(
      isHovered || selectedColorFromStore ? product.id : undefined,
    );

    // TDZ FIX: `allMatchingVariants` antes era declarado na linha ~298, depois
    // do useEffect abaixo que o referencia no array de deps — isso quebrava em
    // runtime com "Cannot access 'allMatchingVariants' before initialization"
    // (TDZ de const em mesma scope). Move-se a derivação para cá, antes do
    // primeiro uso.
    const allMatchingVariants = useMemo(() => {
      const matches = resolveAllMatchingColors(product.colors, activeColorFilter);
      const liveImageByName = new Map<string, string>();
      if (liveVariants?.length) {
        for (const v of liveVariants) {
          if (v.color_name && v.selected_thumbnail) {
            liveImageByName.set(v.color_name.toLowerCase(), v.selected_thumbnail);
          }
        }
      }
      // Se não houver filtros ativos, todas as cores do produto são consideradas para o carrossel
      if (matches.length === 0 && product.colors) {
        return product.colors.map((c) => ({
          name: c.name,
          hex: c.hex || '#888',
          image: c.images?.[0] || c.image || liveImageByName.get(c.name.toLowerCase()),
          groupSlug: c.groupSlug,
          variationSlug: c.variationSlug,
        }));
      }
      // Enriquecer matches com thumbnails vindos do BD externo (lightweight catalog)
      return matches.map((m) => ({
        ...m,
        image: m.image || liveImageByName.get(m.name.toLowerCase()),
      }));
    }, [product.colors, activeColorFilter, liveVariants]);

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

    // ── Word Magic ───────────────────────────────────────────────────────────
    const { displayName, isAIActive } = useWordMagic(product);
    const { carts, addToActiveCart, canCreateCart } = useSellerCartContext();
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
    const [pendingVariant, setPendingVariant] = useState<ExternalVariantStock | null>(null);

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
          // Sempre abre o seletor de carrinho/cliente (mesmo com 0/1 carrinhos),
          // para permitir criar um carrinho novo para outro cliente naquele momento.
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
      [variantPickerMode, product, addFavorite, addToCompare, carts],
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
    const activeColorName = currentVariant?.name || getActiveColorName(product, activeColorFilter);

    // Se houver uma cor ativa (selecionada ou filtrada), forçamos a imagem dessa cor
    const currentImageUrl = useMemo(() => {
      // Prioridade 1: Imagem da variante atual do carrossel/seleção
      if (currentVariant?.image) return currentVariant.image;

      // Prioridade 1.5: Imagem do batch enrichment de cor (useColorEnrichment via ProductGrid).
      // Ativado apenas quando filtro de cor ativo — resolve imagem real da variante de cor
      // sem depender de product.colors[].images (ausentes no catálogo lightweight).
      // FIX ISSUE-02 2026-06-09
      if (colorEnrichmentImage && activeColorFilter) return colorEnrichmentImage;

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

        // Prioridade 3.5: thumbnail vindo de useExternalVariantStock
        // (lightweight catalog não traz colors[].images — fallback ao banco externo)
        const liveMatch = liveVariants?.find(
          (v) => (v.color_name ?? '').toLowerCase() === activeColorName.toLowerCase(),
        );
        if (liveMatch?.selected_thumbnail) return liveMatch.selected_thumbnail;
      }

      // Fallback: primary_image_url (é a imagem com is_primary=true, campo canônico)
      return product.primary_image_url || product.og_image_url || product.images[0] || null;
    }, [
      product,
      activeColorFilter,
      currentVariant,
      activeColorName,
      colorEnrichmentImage,
      liveVariants,
    ]);

    // Caso de fallback para quando a imagem da cor não existe
    const effectiveImageUrl = currentImageUrl || '/placeholder.svg';

    const cardImageUrl =
      effectiveImageUrl !== '/placeholder.svg'
        ? getCdnUrl(effectiveImageUrl, 'card')
        : '/placeholder.svg';
    const cardSrcSet =
      effectiveImageUrl !== '/placeholder.svg' &&
      (effectiveImageUrl === product.primary_image_url ||
        effectiveImageUrl === product.og_image_url ||
        effectiveImageUrl === product.images[0])
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
        data-product-name={product.name}
        data-product-price={product.price ?? ''}
        data-product-stock={product.stock ?? ''}
        data-product-created-at={product.created_at ?? ''}
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
            const colorParam = activeColorName
              ? `?cor=${encodeURIComponent(activeColorName)}&pid=${product.id}`
              : '';
            navigate(`/produto/${product.id}${colorParam}`);
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
            params.set('pid', product.id);
            if (currentVariant.groupSlug) params.set('grupo', currentVariant.groupSlug);
            navigate(`/produto/${product.id}?${params}`);
          } else {
            const colorParam = activeColorName
              ? `?cor=${encodeURIComponent(activeColorName)}&pid=${product.id}`
              : '';
            navigate(`/produto/${product.id}${colorParam}`);
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
          cardImageBlurhash={product.primary_image_blurhash}
          onStatusClick={handleStatusClick}
          isUpdatingColor={isUpdatingColor}
          categoryName={leafCategory?.name}
          categoryPath={leafCategory?.path}
        />

        {/* Word Magic Badge — visível quando AI está ativa */}
        <WordMagicBadge visible={isAIActive} />

        {/* Quick Actions FAB */}
        {(() => {
          const liveMatch =
            selectedColorFromStore && activeColorName && liveVariants?.length
              ? liveVariants.find(
                  (v) => (v.color_name ?? '').toLowerCase() === activeColorName.toLowerCase(),
                )
              : undefined;
          const liveStock = liveMatch?.stock_quantity ?? null;
          const colorStock = resolveColorStock(product, activeColorFilter, activeColorName);
          const effectiveStatus =
            liveStock !== null
              ? liveStock <= 0
                ? 'out-of-stock'
                : 'in-stock'
              : (colorStock?.stockStatus ?? product.stockStatus);
          const isOutOfStock = effectiveStatus === 'out-of-stock';

          return (
            <ProductCardActions
              productId={product.id}
              productName={product.name}
              productSku={product.sku}
              productImageUrl={
                product.primary_image_url || product.og_image_url || product.images[0]
              }
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
            'relative flex flex-1 flex-col space-y-2 p-3 transition-all duration-500 sm:space-y-3 sm:p-4',
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
              isKit={detectedIsKit}
              className="flex-wrap"
            />
          )}

          {cardIntelligenceBadges.length > 0 && (
            <div
              className="mt-0.5 flex w-full min-w-0 flex-wrap items-center gap-1.5"
              data-testid="product-card-intelligence-badges"
            >
              <IntelligenceBadges badges={cardIntelligenceBadges} className="gap-1.5" />
            </div>
          )}

          <div className="flex min-w-0 items-center justify-start gap-1.5">
            <div className="shrink-1 flex min-w-0 items-center gap-1">
              <span
                className="flex items-center gap-1.5 truncate rounded-lg border border-border/20 bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:text-xs"
                title={`Fornecedor: ${product.supplier.name}`}
              >
                <Building2
                  className={cn('h-3 w-3 shrink-0', getSupplierColors(product.supplier.name).text)}
                  aria-hidden="true"
                />
                <span className="truncate">{product.supplier.name}</span>
              </span>
              <GenderBadge gender={product.gender} size="sm" />
            </div>
          </div>

          <h3
            data-testid="product-card-name"
            data-product-name={product.name}
            className={cn(
              'line-clamp-2 max-h-[2.4rem] min-h-[2.4rem] font-display text-[11.2px] font-bold leading-tight tracking-tight transition-colors duration-300 sm:max-h-[2.8rem] sm:min-h-[2.8rem] sm:text-[12.8px]',
              isAIActive
                ? 'text-violet-700 group-hover:text-violet-600 dark:text-violet-300'
                : 'text-foreground group-hover:text-primary',
            )}
          >
            {displayName}
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
                currentUrl.searchParams.set('pid', product.id);
                window.history.replaceState({}, '', currentUrl.toString());
              }
            }}
          />

          <div className="flex-1" />

          {(() => {
            const hasUserSelectedColor = !!selectedColorFromStore;
            const liveMatch =
              hasUserSelectedColor && activeColorName && liveVariants?.length
                ? liveVariants.find(
                    (v) => (v.color_name ?? '').toLowerCase() === activeColorName.toLowerCase(),
                  )
                : undefined;
            const liveStock = liveMatch?.stock_quantity ?? null;
            const colorStock = resolveColorStock(product, activeColorFilter, activeColorName);
            const displayStock =
              liveStock !== null ? liveStock : (colorStock?.stock ?? product.stock);
            const displayStatus =
              liveStock !== null
                ? liveStock <= 0
                  ? 'out-of-stock'
                  : liveStock < 10
                    ? 'low-stock'
                    : 'in-stock'
                : (colorStock?.stockStatus ?? product.stockStatus);

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
                        : displayStatus === 'low-stock'
                          ? 'bg-warning text-warning-foreground'
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
            <div className="hidden flex-wrap gap-1.5 border-t border-border/50 pt-1.5 sm:flex">
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

          <div className="border-t border-border/30 pt-1 sm:pt-1.5">
            {(() => {
              const activeVariantId =
                activeColorName && liveVariants?.length
                  ? (liveVariants.find(
                      (v) => v.color_name?.toLowerCase() === activeColorName.toLowerCase(),
                    )?.id ?? null)
                  : null;
              return (
                <ProductSales90dButton
                  productId={product.id}
                  variantId={activeVariantId}
                  variantLabel={activeVariantId ? activeColorName : null}
                />
              );
            })()}
          </div>
        </div>

        {/* Dialogs lazy — chunk carregado apenas na primeira abertura (zero custo em memória até então) */}
        {variantPickerOpen && (
          <Suspense fallback={null}>
            <VariantPickerDialog
              open={variantPickerOpen}
              onOpenChange={setVariantPickerOpen}
              productId={product.id}
              productName={product.name}
              mode={variantPickerMode}
              onComplete={handleVariantComplete}
            />
          </Suspense>
        )}

        {selectorOpen && (
          <Suspense fallback={null}>
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
                setSelectorOpen(false);
                setCompanyPickerOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* Picker de empresa — cria carrinho na hora e adiciona o item pendente */}
        {companyPickerOpen && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}

        {collectionModalOpen && (
          <Suspense fallback={null}>
            <AddToCollectionModal
              open={collectionModalOpen}
              onOpenChange={setCollectionModalOpen}
              productId={product.id}
              productName={product.name}
              variant={collectionVariant}
            />
          </Suspense>
        )}

        {quickViewOpen && (
          <Suspense fallback={null}>
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
          </Suspense>
        )}

        {shareDialogOpen && (
          <Suspense fallback={null}>
            <SharePreviewDialog
              open={shareDialogOpen}
              onOpenChange={setShareDialogOpen}
              product={product}
              selectedVariant={shareVariant}
            />
          </Suspense>
        )}
      </article>
    );
  }),
);

ProductCard.displayName = 'ProductCard';
