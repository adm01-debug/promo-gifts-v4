/**
 * ProductCardImage — Image section with carousel, badges, and color dots.
 * Updated to match the props interface used by ProductCard.tsx.
 *
 * FIX 2026-06-01: Props were mismatched (ProductCard passed cardImageUrl,
 * product, allMatchingVariants, etc. but this component still expected
 * the old imageUrl, name, sku, colorVariants interface). Result: imageUrl
 * was undefined → activeSrc undefined → OptimizedImage rendered blank.
 *
 * FEAT 2026-06-02: Hover crossfade to set_image_url (image with all color
 * variations grouped together). When the user hovers a product card that
 * has a set_image_url, the main image fades out and the "todas as cores"
 * image fades in. The effect is suppressed when the user is actively
 * navigating color variants in the mini-carousel (showing the selected
 * variant's image takes priority over the set image).
 */
import { memo } from 'react';
import { Package } from 'lucide-react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { resolveNoveltyDaysRemaining } from '@/lib/products/novelty-days';
import { ProductStatusBadge } from './ProductStatusBadge';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { deriveOriginalUrl } from '@/utils/imageProxy';
import { getCdnUrl } from '@/utils/image-utils';
import { isProductKit } from '@/lib/products/kit-detection';
import { getCatalogStockStatus } from '@/lib/catalog-stock-status';
import type { MatchedColorVariant } from '@/utils/color-variant-carousel';
import type { Product } from '@/types/product-catalog';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';

const DEFAULT_IMAGE_CONFIG = {
  blurAmount: 12,
  zoomAmount: 1.08,
  duration: 600,
};

const VALID_STOCK_STATUSES = new Set(['in-stock', 'low-stock', 'out-of-stock']);

interface ProductCardImageProps {
  /** Full product object — used for name (alt), sku, and badge flags */
  product: Product;
  /** Pre-computed card-size CDN URL (getCdnUrl(rawUrl, 'card')) */
  cardImageUrl: string;
  /** srcSet for responsive loading */
  cardSrcSet?: string;
  /** Name of the currently highlighted color variant */
  activeColorName?: string | null;
  /** Color-specific image URL (may differ from cardImageUrl when a color is selected) */
  colorSpecificImage?: string | null;
  /** Whether the main image has finished loading */
  imageLoaded: boolean;
  /** Whether the card is currently hovered */
  isHovered: boolean;
  /** CSS transform scale for the image */
  computedImageScale: number;
  /** Whether this is a novelty product */
  isNovelty?: boolean;
  /** Days remaining for the novelty period */
  noveltyDaysRemaining?: number;
  /** Highlight colors for the card border */
  highlightColors?: string[];
  /** Active color filter applied to the catalog */
  activeColorFilter?: ActiveColorFilter | null;
  /** All color variants matching the active filter (for the mini-carousel) */
  allMatchingVariants: MatchedColorVariant[];
  /** Whether there are multiple matching variants */
  hasMultipleVariants: boolean;
  /** Safe index into allMatchingVariants (bounds-checked) */
  safeVariantIdx: number;
  /** Called when the image finishes loading */
  onImageLoad?: () => void;
  /** Called when the user clicks a variant dot in the carousel */
  onVariantChange: (idx: number) => void;
  /** Whether to eagerly load the image (first visible cards) */
  priority?: boolean;
  /** Blurhash da imagem primária para usar como placeholder de cor */
  cardImageBlurhash?: string | null;
  /** Called when the user clicks a status/badge pill */
  onStatusClick?: (type: string) => void;
  /** Whether a color update is in progress (shows loading state) */
  isUpdatingColor?: boolean;
  /** Leaf category name/path resolved outside the card, used as fallback for kit detection */
  categoryName?: string | null;
  categoryPath?: readonly string[] | null;
}

export const ProductCardImage = memo(
  ({
    product,
    cardImageUrl,
    cardSrcSet,
    activeColorName: _activeColorName,
    colorSpecificImage: _colorSpecificImage,
    imageLoaded: _imageLoaded,
    isHovered,
    computedImageScale,
    isNovelty,
    noveltyDaysRemaining,
    highlightColors: _highlightColors,
    activeColorFilter: _activeColorFilter,
    allMatchingVariants,
    hasMultipleVariants,
    safeVariantIdx,
    onImageLoad,
    priority = false,
    cardImageBlurhash,
    onStatusClick,
    isUpdatingColor = false,
    categoryName,
    categoryPath,
  }: ProductCardImageProps) => {
    // Resolve the active image: prefer the variant-specific image (if a color is
    // selected in the carousel), otherwise fall back to the card image URL.
    const activeVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;
    const activeSrc = activeVariant?.image || cardImageUrl;

    // ───────────────────────────────────────────────────────────────────────
    // Hover image: set_image_url (todas as cores juntas)
    // Only show it when the user is NOT actively browsing variants — in that
    // case showing the variant-specific image takes priority. When the
    // product has only one variant (or no variants), hover swaps to the
    // grouped "all colors" shot so the user sees the full palette at a glance.
    // ───────────────────────────────────────────────────────────────────────
    const setImageRaw = product.set_image_url ?? null;
    const setImageSrc = setImageRaw ? getCdnUrl(setImageRaw, 'card') : null;
    const hasSetHover = Boolean(setImageSrc) && !hasMultipleVariants;

    // Derive badge flags from the product object
    const featured = product.featured;
    const newArrival = product.newArrival;
    const isKit = isProductKit(product, { categoryName, categoryPath });
    const onSale = product.onSale;
    const hasPackaging = product.hasCommercialPackaging === true;
    // Status de estoque para badges. Fallback defensivo: quando `product.stockStatus`
    // vem ausente/inválido ou divergente de `product.stock` (ex.: marcado como
    // "low-stock" porém quantidade = 0), derivamos do número via SSOT
    // `getCatalogStockStatus`. Isso evita que a badge "Estoque baixo" fique presa
    // quando o backend devolve um payload parcial.
    const stockQty =
      typeof product.stock === 'number' && Number.isFinite(product.stock) ? product.stock : null;
    const rawStatus = VALID_STOCK_STATUSES.has(product.stockStatus as string)
      ? product.stockStatus
      : stockQty !== null
        ? getCatalogStockStatus(stockQty, undefined, product.minQuantity)
        : undefined;
    const reconciledStatus =
      rawStatus === 'low-stock' && stockQty !== null && stockQty <= 0 ? 'out-of-stock' : rawStatus;
    const stockStatus: 'ok' | 'low' | 'unavailable' =
      reconciledStatus === 'out-of-stock'
        ? 'unavailable'
        : reconciledStatus === 'low-stock'
          ? 'low'
          : 'ok';

    return (
      <div className="relative aspect-square w-full overflow-hidden bg-muted/20">
        {/* Loading overlay for color change / skeleton transition */}
        {isUpdatingColor && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 duration-200 animate-in fade-in">
            <div className="flex h-full w-full animate-pulse items-center justify-center bg-muted/30">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </div>
        )}

        {/* Main image container with crossfade transition */}
        <div className="relative h-full w-full overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeSrc}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="absolute inset-0 h-full w-full"
            >
              {activeSrc === '/placeholder.svg' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                    Sem foto disponível
                  </span>
                </div>
              ) : (
                <OptimizedImage
                  src={activeSrc}
                  alt={product.name}
                  srcSet={cardSrcSet}
                  className={cn(
                    'h-full w-full object-contain',
                    'transition-opacity duration-300 ease-in-out',
                    hasSetHover && isHovered && 'opacity-0',
                  )}
                  style={{
                    transform: `scale(${computedImageScale})`,
                    willChange: 'transform',
                    transition: 'transform 0.3s ease-out, opacity 0.3s ease-in-out',
                  }}
                  containerClassName="h-full w-full"
                  urlOriginal={
                    deriveOriginalUrl(activeSrc) || product.primary_image_fallback_url || null
                  }
                  blurhash={cardImageBlurhash}
                  priority={priority}
                  onLoad={onImageLoad}
                  {...DEFAULT_IMAGE_CONFIG}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Set image (todas as cores) — fades in on hover, only when no variant is active */}
        {hasSetHover && setImageSrc && (
          <img
            src={setImageSrc}
            alt={`${product.name} — todas as cores`}
            loading="lazy"
            decoding="async"
            className={cn(
              'pointer-events-none absolute inset-0 h-full w-full object-contain',
              'opacity-0 transition-opacity duration-300 ease-in-out',
              isHovered && 'opacity-100',
            )}
            style={{
              transform: `scale(${computedImageScale})`,
              willChange: 'transform, opacity',
            }}
            onError={(e) => {
              // Hide broken set image gracefully — main image will remain visible
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Badges - Dynamic layout to prevent overlapping */}
        <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-1 p-2 sm:p-3">
          {/* Left-aligned badges (Novelty, Featured, etc.) */}
          <div className="flex flex-1 flex-wrap items-start gap-1 sm:gap-1.5">
            {featured && (
              <ProductStatusBadge
                type="featured"
                size="sm"
                onClick={() => onStatusClick?.('featured')}
              />
            )}

            {(() => {
              // Compute days remaining from product.created_at when explicit
              // novelty props are not provided (catálogo/super filtro/etc).
              const resolvedDaysRemaining = resolveNoveltyDaysRemaining(
                product.created_at,
                noveltyDaysRemaining,
                newArrival,
              );
              const showNovelty = (isNovelty && noveltyDaysRemaining !== undefined) || newArrival;
              if (!showNovelty) return null;
              return (
                <ProductStatusBadge
                  type="novelty"
                  daysRemaining={resolvedDaysRemaining}
                  size="sm"
                  onClick={() => onStatusClick?.('novelty')}
                />
              );
            })()}

            {isKit && (
              <ProductStatusBadge type="kit" size="sm" onClick={() => onStatusClick?.('kit')} />
            )}

            {onSale && (
              <ProductStatusBadge
                type="promotion"
                size="sm"
                onClick={() => onStatusClick?.('promotion')}
              />
            )}

            {hasPackaging && (
              <ProductStatusBadge
                type="packaging"
                size="sm"
                packagingMetadata={{
                  packingType: product.packingType,
                  boxWidthMm: product.boxWidthMm,
                  boxHeightMm: product.boxHeightMm,
                  boxLengthMm: product.boxLengthMm,
                  packagingContext: product.packagingContext,
                }}
                onClick={() => onStatusClick?.('packaging')}
              />
            )}
          </div>

          {/* Right-aligned badges (Stock Status) */}
          <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1.5">
            {stockStatus === 'unavailable' && (
              <ProductStatusBadge
                type="out-of-stock"
                size="sm"
                onClick={() => onStatusClick?.('out-of-stock')}
              />
            )}

            {stockStatus === 'low' && (
              <ProductStatusBadge
                type="urgency"
                urgencyType="limited-stock"
                value="Estoque baixo"
                size="sm"
                onClick={() => onStatusClick?.('urgency')}
              />
            )}
          </div>
        </div>

        {/* SKU badge - bottom right */}
        <div className="absolute bottom-1.5 right-1.5 z-10">
          <Badge
            variant="secondary"
            data-testid="product-card-sku"
            aria-label={`Código do produto: ${product.sku}`}
            className="h-auto bg-background/80 px-1.5 py-0.5 text-[10.5px] font-medium leading-none backdrop-blur-sm"
          >
            {product.sku}
          </Badge>
        </div>

        {/* Color / variant dots - REMOVED from image area as requested */}
      </div>
    );
  },
);
