/**
 * ProductCardImage — Image section with carousel, badges, and color dots.
 * Updated to match the props interface used by ProductCard.tsx.
 *
 * FIX 2026-06-01: Props were mismatched (ProductCard passed cardImageUrl,
 * product, allMatchingVariants, etc. but this component still expected
 * the old imageUrl, name, sku, colorVariants interface). Result: imageUrl
 * was undefined → activeSrc undefined → OptimizedImage rendered blank.
 */
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProductStatusBadge } from './ProductStatusBadge';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/hooks/products/useColorSystem';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
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
}

export const ProductCardImage = memo(function ProductCardImage({
  product,
  cardImageUrl,
  cardSrcSet,
  activeColorName: _activeColorName,
  colorSpecificImage: _colorSpecificImage,
  imageLoaded: _imageLoaded,
  isHovered: _isHovered,
  computedImageScale,
  isNovelty,
  noveltyDaysRemaining,
  highlightColors: _highlightColors,
  activeColorFilter: _activeColorFilter,
  allMatchingVariants,
  hasMultipleVariants,
  safeVariantIdx,
  onImageLoad,
  onVariantChange,
  priority = false,
  onStatusClick,
}: ProductCardImageProps) {
  // Resolve the active image: prefer the variant-specific image (if a color is
  // selected in the carousel), otherwise fall back to the card image URL.
  const activeVariant = hasMultipleVariants ? allMatchingVariants[safeVariantIdx] : null;
  const activeSrc = activeVariant?.image || cardImageUrl;

  // Derive badge flags from the product object
  const featured = product.featured;
  const newArrival = product.newArrival;
  const isKit = product.isKit;
  const onSale = product.onSale;
  const stockStatus: 'ok' | 'low' | 'critical' | 'unavailable' =
    product.stockStatus === 'out-of-stock'
      ? 'unavailable'
      : product.stockStatus === 'low-stock'
        ? 'low'
        : 'ok';

  // Color dots: show all matching variants when a color filter is active,
  // otherwise show the product colors (for products with multiple colors).
  const colorDots = hasMultipleVariants
    ? allMatchingVariants.map((v) => ({ hex: v.hex, name: v.name }))
    : product.colors
        ?.slice(0, 6)
        .map((c) => (typeof c === 'object' ? { hex: (c as { hex: string; name?: string }).hex, name: (c as { hex: string; name?: string }).name } : { hex: '#CCCCCC' }))
        .filter((c) => c.hex) ?? [];

  return (
    <div className="relative aspect-square overflow-hidden">
      <OptimizedImage
        src={activeSrc}
        alt={product.name}
        srcSet={cardSrcSet}
        className={cn('h-full w-full object-contain')}
        style={{
          transform: `scale(${computedImageScale})`,
          willChange: 'transform',
          transition: 'transform 0.3s ease-out',
        }}
        containerClassName="h-full w-full"
        priority={priority}
        onLoad={onImageLoad}
        {...DEFAULT_IMAGE_CONFIG}
      />


      {/* Badges - Top Left */}
      <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
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

        {stockStatus === 'unavailable' && (
          <Badge
            variant="destructive"
            className="h-auto px-1.5 py-0.5 text-[9px] font-medium leading-none shadow-sm"
          >
            Fora de estoque
          </Badge>
        )}

        {(stockStatus === 'low' || stockStatus === 'critical') && (
          <ProductStatusBadge
            type="urgency"
            urgencyType={stockStatus}
            value={stockStatus === 'critical' ? 'Crítico' : 'Baixo'}
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

      {/* Color / variant dots */}
      {colorDots.length > 1 && (
        <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-0.5">
          {colorDots.slice(0, 6).map((color, idx) => (
            <Tooltip key={`${color.hex}-${idx}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-3 w-3 rounded-full border transition-all hover:scale-125',
                    (hasMultipleVariants ? safeVariantIdx : 0) === idx
                      ? 'scale-125 border-primary shadow-sm'
                      : 'border-transparent',
                  )}
                  style={{ backgroundColor: color.hex }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onVariantChange(idx);
                  }}
                  aria-label={color.name || color.hex}
                >
                  {(hasMultipleVariants ? safeVariantIdx : 0) === idx &&
                    isLightColor(color.hex) && (
                      <span className="sr-only">Cor selecionada</span>
                    )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {color.name || color.hex}
              </TooltipContent>
            </Tooltip>
          ))}
          {colorDots.length > 6 && (
            <span className="flex h-3 items-center text-[9px] text-muted-foreground">
              +{colorDots.length - 6}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
