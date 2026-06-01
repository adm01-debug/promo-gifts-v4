/**
 * ProductCardImage — Image section with carousel, badges, and color dots.
 * Extracted from ProductCard.tsx.
 */
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProductStatusBadge } from './ProductStatusBadge';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/hooks/products/useColorSystem';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import type { MatchedColorVariant } from '@/utils/color-variant-carousel';

const DEFAULT_IMAGE_CONFIG = {
  blurAmount: 12,
  zoomAmount: 1.08,
  duration: 600,
};

interface ProductCardImageProps {
  imageUrl: string;
  name: string;
  sku: string;
  featured?: boolean;
  isNovelty?: boolean;
  noveltyDaysRemaining?: number;
  newArrival?: boolean;
  isKit?: boolean;
  onSale?: boolean;
  stockStatus?: 'ok' | 'low' | 'critical' | 'unavailable';
  computedImageScale?: number;
  colors?: { hex: string; name?: string }[];
  activeColorIdx?: number;
  onColorClick?: (idx: number) => void;
  colorVariants?: MatchedColorVariant[];
  onStatusClick?: (type: string) => void;
  lqip?: string;
}

export const ProductCardImage = memo(function ProductCardImage({
  imageUrl,
  name,
  sku,
  featured,
  isNovelty,
  noveltyDaysRemaining,
  newArrival,
  isKit,
  onSale,
  stockStatus,
  computedImageScale = 1,
  colors = [],
  activeColorIdx = 0,
  onColorClick,
  colorVariants,
  onStatusClick,
  lqip,
}: ProductCardImageProps) {
  const activeVariant = colorVariants?.[activeColorIdx];
  const activeSrc = activeVariant?.imageUrl || imageUrl;
  const activeLqip = activeVariant?.lqip || lqip;

  return (
    <div className="relative aspect-square overflow-hidden">
      <OptimizedImage
        src={activeSrc}
        alt={name}
        lqip={activeLqip}
        className={cn('h-full w-full object-contain')}
        style={
          {
            transform: `scale(${computedImageScale})`,
            willChange: 'transform',
            transition: 'transform 0.3s ease-out',
          }
        }
        containerClassName="h-full w-full"
        {...DEFAULT_IMAGE_CONFIG}
      />

      {/* Stock badge */}
      {stockStatus === 'unavailable' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <Badge variant="destructive" className="text-[10px]">
            Fora de estoque
          </Badge>
        </div>
      )}

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
            value="-20%"
            size="sm"
            onClick={() => onStatusClick?.('promotion')}
          />
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
          {sku}
        </Badge>
      </div>

      {/* Color dots */}
      {colors.length > 0 && (
        <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-0.5">
          {colors.slice(0, 6).map((color, idx) => (
            <Tooltip key={`${color.hex}-${idx}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'h-3 w-3 rounded-full border transition-all hover:scale-125',
                    activeColorIdx === idx ? 'border-primary scale-125 shadow-sm' : 'border-transparent',
                  )}
                  style={{ backgroundColor: color.hex }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorClick?.(idx);
                  }}
                  aria-label={color.name || color.hex}
                >
                  {activeColorIdx === idx && isLightColor(color.hex) && (
                    <span className="sr-only">Cor selecionada</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {color.name || color.hex}
              </TooltipContent>
            </Tooltip>
          ))}
          {colors.length > 6 && (
            <span className="flex h-3 items-center text-[9px] text-muted-foreground">
              +{colors.length - 6}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
