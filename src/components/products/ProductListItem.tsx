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
import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Heart, GitCompare, Share2, Package, Building2, FolderPlus, Eye, FileText } from "lucide-react";
import { NoveltyBadge } from "./NoveltyBadge";
import { ListItemActions } from "./list-item/ListItemActions";
import { useNavigate } from "react-router-dom";
import { getCdnUrl } from "@/utils/image-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isLightColor, type ExternalVariantStock, type Product } from "@/hooks/products";
import { toast } from "sonner";
import { GenderBadge } from "./GenderBadge";
import { getSupplierColors } from "@/lib/supplier-colors";
import { resolveColorImage, resolveColorStock, getActiveColorName, type ActiveColorFilter } from "@/utils/color-image-resolver";
import { resolveHighlightHex } from "@/utils/color-group-hex";
import { PriceFreshnessBadge } from "./PriceFreshnessBadge";
import { resolveAllMatchingColors } from "@/utils/color-variant-carousel";
import { showUndoToast, showErrorToast } from "@/utils/undoToast";
import { QuickAddToQuote } from "./QuickAddToQuote";
import { AddToCollectionModal } from "@/components/collections/AddToCollectionModal";
import { ProductQuickView } from "./ProductQuickView";
import { SharePreviewDialog } from "./share/SharePreviewDialog";
import { VariantPickerDialog, type VariantActionMode } from "./VariantPickerDialog";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useComparisonStore } from "@/stores/useComparisonStore";

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
}

export const ProductListItem = memo(function ProductListItem({
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
}: ProductListItemProps) {
  const navigate = useNavigate();
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionVariant, setCollectionVariant] = useState<{ color_name?: string | null; color_hex?: string | null; variant_id?: string | null; thumbnail?: string | null } | undefined>(undefined);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareVariant, setShareVariant] = useState<{ variantName?: string | null; colorHex?: string | null; thumbnailUrl?: string | null } | null>(null);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');
  const actionBusyRef = useRef(false);
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);

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

  const markBusy = () => {
    actionBusyRef.current = true;
    setTimeout(() => { actionBusyRef.current = false; }, 500);
  };

  const handleVariantComplete = useCallback((variant: ExternalVariantStock | null) => {
    const variantInfo = variant ? {
      color_name: variant.color_name,
      color_hex: variant.color_hex,
      size_code: variant.size_code,
      variant_id: variant.id,
      thumbnail: variant.selected_thumbnail,
    } : undefined;

    if (variantPickerMode === 'favorite') {
      favStore.addFavorite(product.id, variantInfo);
      toast.success(`"${product.name}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`);
    } else if (variantPickerMode === 'compare') {
      const result = compStore.addToCompare(product.id, variantInfo);
      if (!result) {
        showErrorToast({ title: "Limite de 4 produtos para comparação atingido" });
      } else {
        toast.success(`"${product.name}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`);
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
      if (product.images?.[0]) params.set('product_image', variant?.selected_thumbnail || product.images[0]);
      setTimeout(() => navigate(`/orcamentos/novo?${params.toString()}`), 0);
    } else if (variantPickerMode === 'share') {
      setShareVariant(variant ? {
        variantName: variant.color_name,
        colorHex: variant.color_hex,
        thumbnailUrl: variant.selected_thumbnail,
      } : null);
      setShareDialogOpen(true);
    }
  }, [variantPickerMode, product, favStore, compStore, navigate]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const getStockColor = (status: string) => {
    switch (status) {
      case "in-stock": return "text-success";
      case "low-stock": return "text-warning";
      case "out-of-stock": return "text-destructive";
      default: return "text-success";
    }
  };

  const getStockLabel = (status: string) => {
    switch (status) {
      case "in-stock": return "Em estoque";
      case "low-stock": return "Estoque baixo";
      case "out-of-stock": return "Sem estoque";
      default: return "Em estoque";
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionBusyRef.current || variantPickerOpen || collectionModalOpen || quickViewOpen || shareDialogOpen) return;
    
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
    } else {
      if (onView) onView(product);
      else navigate(`/produto/${product.id}`);
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
  const safeVariantIdx = hasMultipleVariants ? Math.min(activeVariantIdx, allMatchingVariants.length - 1) : 0;
  const currentVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;

  const variantImage = currentVariant?.image;
  const colorSpecificImage = variantImage || resolveColorImage(product, activeColorFilter);
  const rawImageUrl = colorSpecificImage || product.og_image_url || product.images[0] || null;
  const thumbUrl = rawImageUrl ? getCdnUrl(rawImageUrl, "card") : "/placeholder.svg";

  const colorStock = resolveColorStock(product, activeColorFilter);
  const displayStock = colorStock?.stock ?? product.stock;
  const displayStatus = colorStock?.stockStatus ?? product.stockStatus;

  const activeColorName = currentVariant?.name || getActiveColorName(product, activeColorFilter);

  const matchedHighlightColor = currentVariant?.hex || resolveHighlightHex(product.colors, activeColorFilter, highlightColors);

  const hasColorMatch = !!matchedHighlightColor || (highlightColors.length > 0 &&
    product.colors.some((c) => highlightColors.includes(c.group))) ||
    !!activeColorName;

  return (
    <>
      <article
        
        className={cn(
          "group relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5",
          "rounded-xl bg-card cursor-pointer",
          "transition-all duration-200 ease-out",
          "active:scale-[0.997] touch-manipulation",
          hasColorMatch && matchedHighlightColor ? "border-2" : "border border-border/50 hover:border-primary/30 hover:bg-accent/30 hover:shadow-md",
        )}
        style={hasColorMatch && matchedHighlightColor ? {
          borderColor: `${matchedHighlightColor}70`,
          boxShadow: `inset 0 0 30px -6px ${matchedHighlightColor}40, 0 0 8px -2px ${matchedHighlightColor}20`,
        } as React.CSSProperties : undefined}
        onClick={handleClick}
      >
        {/* Thumbnail — compact square */}
        <div className="relative shrink-0 w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-lg overflow-hidden bg-muted/30 border border-border/30">
          <img
            src={thumbUrl}
            alt={product.name}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) {
                img.dataset.fallback = "1";
                img.src = product.images[0] || "/placeholder.svg";
              }
            }}
          />
          {/* Multi-variant dots */}
          {hasMultipleVariants && (
            <div
              role="tablist"
              aria-label="Variantes de cor"
              className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-1 z-10"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setActiveVariantIdx((safeVariantIdx + 1) % allMatchingVariants.length);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setActiveVariantIdx((safeVariantIdx - 1 + allMatchingVariants.length) % allMatchingVariants.length);
                }
              }}
            >
              {allMatchingVariants.map((v, i) => (
                <button
                  key={v.groupSlug || v.variationSlug || i}
                  role="tab"
                  type="button"
                  tabIndex={i === safeVariantIdx ? 0 : -1}
                  aria-selected={i === safeVariantIdx}
                  onClick={(e) => { e.stopPropagation(); setActiveVariantIdx(i); }}
                  className={cn(
                    "w-3 h-3 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i === safeVariantIdx ? "ring-1 ring-offset-1 ring-offset-card scale-110" : "opacity-60 border-border/50"
                  )}
                  style={{
                    backgroundColor: v.hex,
                    borderColor: i === safeVariantIdx
                      ? (isLightColor(v.hex) ? 'hsl(var(--muted-foreground))' : v.hex)
                      : undefined,
                    ['--tw-ring-color' as string]: i === safeVariantIdx
                      ? (isLightColor(v.hex) ? 'hsl(var(--muted-foreground) / 0.6)' : v.hex)
                      : v.hex,
                  }}
                  aria-label={`Ver ${v.name}`}
                  title={v.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info — main content block */}
        <div className="flex-1 min-w-0 py-0.5">
          {/* Top meta row */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-0.5">
            {isNovelty && noveltyDaysRemaining !== undefined && (
              <NoveltyBadge daysRemaining={noveltyDaysRemaining} size="sm" />
            )}
            <span className="truncate max-w-[120px]">{product.category?.name || "Sem categoria"}</span>
            <span className="text-border">•</span>
            <span className={cn("flex items-center gap-0.5 shrink-0", getSupplierColors(product.supplier.name).text)}>
              <Building2 className="h-2.5 w-2.5" />
              <span className="truncate max-w-[80px]">{product.supplier.name}</span>
            </span>
            <GenderBadge gender={product.gender} size="sm" />
          </div>

          {/* Product name */}
          <h3 data-testid="product-list-name" className="font-display font-semibold text-foreground text-sm sm:text-[15px] leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Active color badge */}
          {activeColorName && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary/80 w-fit mt-0.5">
              {activeColorName}
            </Badge>
          )}

          {/* Stock + SKU row */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("flex items-center gap-1 text-[10px] sm:text-xs font-medium", getStockColor(displayStatus))}>
              <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {getStockLabel(displayStatus)} ({displayStock.toLocaleString("pt-BR")})
            </span>
            {product.sku && (
              <span className="text-[10px] text-muted-foreground/50 font-mono hidden sm:inline">
                {product.sku}
              </span>
            )}
            {/* Inline color dots */}
            {product.colors.length > 0 && (
              <div className="hidden md:flex items-center gap-1 ml-1">
                {product.colors.slice(0, 5).map((color, idx) => {
                  const isHighlighted = highlightColors.includes(color.group) ||
                    (activeColorFilter?.groups?.includes(color.groupSlug || '') ?? false) ||
                    (activeColorFilter?.variations?.includes(color.variationSlug || '') ?? false);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "w-3 h-3 rounded-full border",
                        isHighlighted
                          ? "border-success ring-1 ring-success/30 scale-110"
                          : "border-border/50"
                      )}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    />
                  );
                })}
                {product.colors.length > 5 && (
                  <span className="text-[9px] text-muted-foreground">+{product.colors.length - 5}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Price column — right-aligned, always visible */}
        <div className="shrink-0 text-right min-w-[80px] sm:min-w-[100px]">
          <span className="text-base sm:text-lg font-display font-bold text-foreground whitespace-nowrap">
            {formatPrice(product.price)}
          </span>
          <div className="mt-0.5 flex justify-end">
            <PriceFreshnessBadge
              priceUpdatedAt={product.priceUpdatedAt}
              thresholdDays={product.priceFreshnessThresholdDays}
              variant="compact"
            />
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
        onOpenChange={setQuickViewOpen}
        isFavorited={isFavorited}
        onToggleFavorite={onToggleFavorite}
        isInCompare={isInCompare}
        onToggleCompare={onToggleCompare}
        onShare={onShare}
      />

      {/* Share Preview Dialog */}
      <SharePreviewDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        product={product}
        selectedVariant={shareVariant}
      />
    </>
  );
});

ProductListItem.displayName = 'ProductListItem';
