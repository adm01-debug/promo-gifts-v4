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
import { Badge } from '@/components/ui/badge';
import { ProductStatusBadge } from './ProductStatusBadge';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getCdnUrl } from '@/utils/image-utils';
import type { MatchedColorVariant } from '@/utils/color-variant-carousel';
import type { Product } from '@/types/product-catalog';
import type { ActiveColorFilter } from '@/utils/color-image-resolver';

const DEFAULT_IMAGE_CONFIG = {
  blurAmount: 12,
  zoomAmount: 1.08,
  duration: 600,
};

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
  /** Called when the user clicks a status/badge pill */
  onStatusClick?: (type: string) => void;
  /** Whether a color update is in progress (shows loading state) */
  isUpdatingColor?: boolean;
}

export const ProductCardImage = memo(function ProductCardImage({
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
  onStatusClick,
  isUpdatingColor = false,
}: ProductCardImageProps) {
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
  const isKit = product.isKit;
  const onSale = product.onSale;
  const hasPackaging = product.hasCommercialPackaging === true;
  const stockStatus: 'ok' | 'low' | 'unavailable' =
    product.stockStatus === 'out-of-stock'
      ? 'unavailable'
      : product.stockStatus === 'low-stock'
        ? 'low'
        : 'ok';

  return (
    <div className="relative aspect-square overflow-hidden bg-muted/20">
      {/* Loading overlay for color change */}
      {isUpdatingColor && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/20 backdrop-blur-[2px] duration-200 animate-in fade-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Main image — fades out on hover when set image is available */}
      <div key={activeSrc} className="relative h-full w-full duration-500 animate-in fade-in">
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
            priority={priority}
            onLoad={onImageLoad}
            {...DEFAULT_IMAGE_CONFIG}
          />
        )}
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

      {/* Badges - Top Left */}
      <div className="absolute left-2 top-2 z-10 flex flex-col items-start gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
        {featured && (
          <ProductStatusBadge
            type="featured"
            size="sm"
            onClick={() => onStatusClick?.('featured')}
          />
        )}

        {isNovelty && noveltyDaysRemaining !== undefined ? (
          <ProductStatusBadge
            type="novelty"
            daysRemaining={noveltyDaysRemaining}
            size="sm"
            onClick={() => onStatusClick?.('novelty')}
          />
        ) : (
          newArrival && (
            <ProductStatusBadge
              type="novelty"
              value="Novo"
              size="sm"
              onClick={() => onStatusClick?.('novelty')}
            />
          )
        )}

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

        {/* Stock status badge removed from here as requested - keeping only the bottom one */}

        {stockStatus === 'low' && (
          <ProductStatusBadge
            type="urgency"
            urgencyType="limited-stock"
            value="Baixo"
            size="sm"
            onClick={() => onStatusClick?.('urgency')}
          />
        )}
      </div>

      {/* SKU badge - bottom right */}
      <div className="absolute bottom-1.5 right-1.5 z-10">
        <Badge
          variant="secondary"
          className="h-auto bg-background/80 px-1.5 py-0.5 text-[9px] font-medium leading-none backdrop-blur-sm"
        >
          {product.sku}
        </Badge>
      </div>

      {/* Color / variant dots - REMOVED from image area as requested */}
    </div>
  );
});
