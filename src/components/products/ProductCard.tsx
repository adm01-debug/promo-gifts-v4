/**
 * ProductCard — Main catalog card component.
 * Refactored: image section in ProductCardImage, FAB actions in ProductCardActions.
 */
import { useState, useRef, useEffect, memo, forwardRef, useCallback } from "react";
import { GenderBadge } from "./GenderBadge";
import { Building2, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getCdnUrl, getSrcSet } from "@/utils/image-utils";
import { cn } from "@/lib/utils";
import { useProductBounds, type ExternalVariantStock, type Product, usePrefetchProduct } from "@/hooks/products";
import { toast } from "sonner";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { ProductQuickView } from "./ProductQuickView";
import { ProductCategoryBadges } from "./ProductCategoryBadges";
import { showUndoToast, showErrorToast } from "@/utils/undoToast";
import { getSupplierColors } from "@/lib/supplier-colors";
import { resolveColorImage, resolveColorStock, getActiveColorName, type ActiveColorFilter } from "@/utils/color-image-resolver";
import { resolveHighlightHex } from "@/utils/color-group-hex";
import { resolveAllMatchingColors } from "@/utils/color-variant-carousel";
import { ProductSparkline } from "./ProductSparkline";
import { VariantPickerDialog, type VariantActionMode } from "./VariantPickerDialog";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useComparisonStore } from "@/stores/useComparisonStore";
import { SharePreviewDialog } from "./share/SharePreviewDialog";
import { ProductCardImage } from "./ProductCardImage";
import { ProductCardActions } from "./ProductCardActions";
import { PriceFreshnessBadge } from "./PriceFreshnessBadge";
import { feedback } from "@/lib/feedback";
import { telemetryService } from "@/services/telemetryService";

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
}

export const ProductCard = memo(forwardRef<HTMLElement, ProductCardProps>(function ProductCard({ 
  product, onClick, onView, onShare, onFavorite, highlightColors,
  isFavorited = false, onToggleFavorite,
  isInCompare = false, onToggleCompare, canAddToCompare = true,
  hideCategoryBadges = false, isNovelty = false, noveltyDaysRemaining,
  activeColorFilter,
  priority = false,
}, ref) {
  const navigate = useNavigate();
  const _queryClient = useQueryClient();
  const { prefetchProduct } = usePrefetchProduct();
  const [isHovered, setIsHovered] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionVariant, setCollectionVariant] = useState<{ color_name?: string | null; color_hex?: string | null; variant_id?: string | null; thumbnail?: string | null } | undefined>(undefined);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareVariant, setShareVariant] = useState<{ variantName?: string | null; colorHex?: string | null; thumbnailUrl?: string | null } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

  const filterKey = activeColorFilter
    ? `${(activeColorFilter.groups || []).join(',')}|${(activeColorFilter.variations || []).join(',')}`
    : '';
  const prevFilterKeyRef = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) { setActiveVariantIdx(0); prevFilterKeyRef.current = filterKey; }
  }, [filterKey]);

  const actionBusyRef = useRef(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');

  const favStore = useFavoritesStore();
  const compStore = useComparisonStore();

  const handleVariantComplete = useCallback((variant: ExternalVariantStock | null) => {
    const variantInfo = variant ? {
      color_name: variant.color_name, color_hex: variant.color_hex,
      size_code: variant.size_code, variant_id: variant.id,
      thumbnail: variant.selected_thumbnail,
    } : undefined;

    if (variantPickerMode === 'favorite') {
      favStore.addFavorite(product.id, variantInfo);
      feedback.light();
      toast.success(`"${product.name}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`);
    } else if (variantPickerMode === 'compare') {
      const result = compStore.addToCompare(product.id, variantInfo);
      if (!result) {
        feedback.error();
        showErrorToast({ title: "Limite de 4 produtos para comparação atingido" });
      } else {
        feedback.light();
        toast.success(`"${product.name}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`);
      }
    } else if (variantPickerMode === 'collection') {
      setCollectionVariant(variantInfo);
      setCollectionModalOpen(true);
    } else if (variantPickerMode === 'quote') {
      const params = new URLSearchParams({
        product_id: product.id, product_name: product.name,
        product_sku: product.sku || '', product_price: String(product.price ?? 0),
      });
      if (variant?.color_name) params.set('color_name', variant.color_name);
      if (variant?.color_hex) params.set('color_hex', variant.color_hex);
      if (variant?.selected_thumbnail) params.set('product_image', variant.selected_thumbnail);
      if (product.images?.[0]) params.set('product_image', variant?.selected_thumbnail || product.images[0]);
      setTimeout(() => navigate(`/orcamentos/novo?${params.toString()}`), 0);
    } else if (variantPickerMode === 'share') {
      setShareVariant(variant ? { variantName: variant.color_name, colorHex: variant.color_hex, thumbnailUrl: variant.selected_thumbnail } : null);
      setShareDialogOpen(true);
    }
  }, [variantPickerMode, product, favStore, compStore, navigate]);

  const markBusy = () => { actionBusyRef.current = true; setTimeout(() => { actionBusyRef.current = false; }, 500); };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); markBusy(); setActionsOpen(false);
    if (isFavorited) {
      if (onToggleFavorite) {
        onToggleFavorite(product.id);
        showUndoToast({ title: `"${product.name}" removido dos favoritos`, onUndo: () => onToggleFavorite(product.id) });
      }
    } else { setVariantPickerMode('favorite'); setVariantPickerOpen(true); }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation(); markBusy(); setActionsOpen(false);
    if (isInCompare) {
      if (onToggleCompare) {
        onToggleCompare(product.id);
        showUndoToast({ title: `"${product.name}" removido da comparação`, onUndo: () => onToggleCompare(product.id) });
      }
    } else { setVariantPickerMode('compare'); setVariantPickerOpen(true); }
  };

  const formatPrice = (price: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const getStockStatusColor = (status: string) => {
    switch (status) { case 'in-stock': return 'in-stock'; case 'low-stock': return 'low-stock'; case 'out-of-stock': return 'out-of-stock'; default: return 'in-stock'; }
  };
  const getStockStatusLabel = (status: string) => {
    switch (status) { case 'in-stock': return 'Em estoque'; case 'low-stock': return 'Estoque baixo'; case 'out-of-stock': return 'Sem estoque'; default: return 'Em estoque'; }
  };

  // Multi-variant carousel
  const allMatchingVariants = resolveAllMatchingColors(product.colors, activeColorFilter);
  const hasMultipleVariants = allMatchingVariants.length > 1;
  const safeVariantIdx = hasMultipleVariants ? Math.min(activeVariantIdx, allMatchingVariants.length - 1) : 0;
  const currentVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;
  const matchedHighlightColor = currentVariant?.hex || resolveHighlightHex(product.colors, activeColorFilter, highlightColors);
  const hasHighlightedColor = !!matchedHighlightColor;

  const variantImage = currentVariant?.image;
  const colorSpecificImage = variantImage || resolveColorImage(product, activeColorFilter);
  const rawImageUrl = colorSpecificImage || product.og_image_url || product.images[0] || null;
  const cardImageUrl = rawImageUrl ? getCdnUrl(rawImageUrl, "card") : "/placeholder.svg";
  const cardSrcSet = colorSpecificImage ? undefined : (rawImageUrl ? getSrcSet(rawImageUrl) : undefined);
  const activeColorName = currentVariant?.name || getActiveColorName(product, activeColorFilter);

  const imageBounds = useProductBounds(cardImageUrl !== "/placeholder.svg" ? cardImageUrl : null, { whiteThreshold: 230, margin: 0.01, maxSize: 384 });
  const isOversizedImage = imageBounds.detected && imageBounds.fractionX >= 0.86 && imageBounds.fractionY >= 0.86;
  const computedImageScale = Number(((isOversizedImage ? 0.88 : 1) * (isHovered ? 1.03 : 1)).toFixed(3));

  return (
    <article
      ref={ref}
      data-testid="product-card"
      data-product-id={product.id}
      className={cn(
        "group relative overflow-hidden rounded-xl sm:rounded-2xl bg-card cursor-pointer card-lift",
        "transition-all duration-300 ease-out active:scale-[0.98] active:transition-transform active:duration-100 touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        product.featured && "ring-2 ring-primary/20 shadow-lg",
        hasHighlightedColor ? "border-2 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.1)]" : "border-border/40 hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.15)]",
      )}
      style={hasHighlightedColor && matchedHighlightColor ? {
        borderColor: `${matchedHighlightColor}70`,
        boxShadow: `inset 0 0 30px -6px ${matchedHighlightColor}40, 0 0 8px -2px ${matchedHighlightColor}20`,
      } as React.CSSProperties : undefined}
      onMouseEnter={() => {
        setIsHovered(true);
        // Telemetry for analytics (popular products)
        telemetryService.logUXAction('product_hover', { productId: product.id, name: product.name });

        // Prefetch product details when hovering to make "click to open" instant
        prefetchProduct(product.id);
      }}
      onMouseLeave={() => { setIsHovered(false); setActionsOpen(false); }}
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
        if (actionsOpen || actionBusyRef.current || variantPickerOpen || collectionModalOpen || quickViewOpen) { 
          e.stopPropagation(); 
          return; 
        }
        
        // Use provided onClick if available, otherwise default to navigation
        if (onClick) {
          onClick();
          return;
        }

        // Default navigation
        if (currentVariant?.name) {
          const params = new URLSearchParams();
          params.set('cor', currentVariant.name);
          if (currentVariant.groupSlug) params.set('grupo', currentVariant.groupSlug);
          if (currentVariant.hex) params.set('hex', currentVariant.hex);
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
        activeColorName={activeColorName}
        colorSpecificImage={colorSpecificImage}
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
        onVariantChange={(idx) => { setActiveVariantIdx(idx); setImageLoaded(false); }}
        priority={priority}
      />

      {/* Quick Actions FAB */}
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
        onToggleActions={() => setActionsOpen(!actionsOpen)}
        onFavorite={handleFavorite}
        onCompare={handleCompare}
        onOpenVariantPicker={(mode) => { setActionsOpen(false); setVariantPickerMode(mode); setVariantPickerOpen(true); }}
        onQuickView={() => { setActionsOpen(false); setQuickViewOpen(true); }}
        markBusy={markBusy}
      />

      {/* Info section */}
      <div className={cn(
        "relative p-3 sm:p-5 space-y-2.5 sm:space-y-4 transition-all duration-500",
        isHovered ? "bg-background/95 backdrop-blur-md translate-y-[-2px]" : "bg-background"
      )} style={{ zIndex: 10 }}>
        {!hideCategoryBadges && (
          <ProductCategoryBadges category={product.category} groups={product.groups} categoryUuid={product.category_id} className="flex-wrap" />
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] sm:text-xs text-muted-foreground font-mono tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">{product.sku}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <GenderBadge gender={product.gender} size="sm" />
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-semibold truncate max-w-[120px] flex items-center gap-1.5 border border-border/20">
              <Building2 className={cn("h-3 w-3 shrink-0", getSupplierColors(product.supplier.name).text)} />
              {product.supplier.name}
            </span>
          </div>
        </div>

        <h3
          data-testid="product-card-name"
          data-product-name={product.name}
          className="font-display font-bold text-foreground line-clamp-2 min-h-[2.25rem] sm:min-h-[2.75rem] text-sm sm:text-base leading-tight group-hover:text-primary transition-colors duration-300 tracking-tight"
        >
          {product.name}
        </h3>

        {(() => {
          const colorStock = resolveColorStock(product, activeColorFilter);
          const displayStock = colorStock?.stock ?? product.stock;
          const displayStatus = colorStock?.stockStatus ?? product.stockStatus;
          return (
            <div className="flex items-end justify-between pt-0.5 sm:pt-1">
              <div>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium mb-0.5 opacity-70">A partir de</p>
                <span className="text-base sm:text-2xl font-display font-black text-foreground inline-flex items-center gap-2 tracking-tight">
                  {formatPrice(product.price)}
                  <PriceFreshnessBadge
                    priceUpdatedAt={product.priceUpdatedAt}
                    thresholdDays={product.priceFreshnessThresholdDays}
                    variant="icon-only"
                  />
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                <span className={cn("stock-indicator text-[10px] sm:text-xs", getStockStatusColor(displayStatus))}>
                  <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  <span className="hidden sm:inline">{getStockStatusLabel(displayStatus)}</span>
                  <span className="sm:hidden">{displayStatus === 'in-stock' ? '✓' : displayStatus === 'low-stock' ? '!' : '✗'}</span>
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{(displayStock ?? 0).toLocaleString('pt-BR')} un.</span>
              </div>
            </div>
          );
        })()}

        {Array.isArray(product.materials) && product.materials.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
            {product.materials.slice(0, 2).map((material) => (
              <span key={material} className="text-xs px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground font-medium">{material}</span>
            ))}
            {product.materials.length > 2 && <span className="text-xs px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground font-medium">+{product.materials.length - 2}</span>}
          </div>
        )}

        <div className="pt-1.5 sm:pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Vendas 30d</span>
          </div>
          <ProductSparkline productId={product.id} />
        </div>
      </div>

      {/* Dialogs */}
      <VariantPickerDialog open={variantPickerOpen} onOpenChange={setVariantPickerOpen}
        productId={product.id} productName={product.name} mode={variantPickerMode} onComplete={handleVariantComplete} />
      <AddToCollectionModal open={collectionModalOpen} onOpenChange={setCollectionModalOpen}
        productId={product.id} productName={product.name} variant={collectionVariant} />
      <ProductQuickView product={product} open={quickViewOpen} onOpenChange={setQuickViewOpen}
        isFavorited={isFavorited} onToggleFavorite={onToggleFavorite}
        isInCompare={isInCompare} onToggleCompare={onToggleCompare} onShare={onShare} />
      <SharePreviewDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}
        product={product} selectedVariant={shareVariant} />
    </article>
  );
}));

ProductCard.displayName = 'ProductCard';
