/**
 * ProductCardImage — Image section with carousel, badges, and color dots.
 * Extracted from ProductCard.tsx.
 */
import { memo } from "react";
import { Sparkles, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NoveltyBadge } from "./NoveltyBadge";
import { cn } from "@/lib/utils";
import { isLightColor } from "@/hooks/products/useColorSystem";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { MatchedColorVariant } from "@/utils/color-variant-carousel";

interface ProductCardImageProps {
  priority?: boolean;
  product: {
    name: string;
    featured?: boolean;
    newArrival?: boolean;
    isKit?: boolean;
    onSale?: boolean;
    images: string[];
    colors: Array<{ hex: string; name: string; group: string; groupSlug?: string; variationSlug?: string }>;
  };
  cardImageUrl: string;
  cardSrcSet?: string;
  activeColorName: string | null;
  colorSpecificImage: string | null;
  imageLoaded: boolean;
  isHovered: boolean;
  computedImageScale: number;
  isNovelty: boolean;
  noveltyDaysRemaining?: number;
  highlightColors?: string[];
  activeColorFilter?: { groups?: string[]; variations?: string[] } | null;
  // Multi-variant carousel
  allMatchingVariants: MatchedColorVariant[];
  hasMultipleVariants: boolean;
  safeVariantIdx: number;
  onImageLoad: () => void;
  onVariantChange: (idx: number) => void;
}

export const ProductCardImage = memo(function ProductCardImage({
  product, cardImageUrl, cardSrcSet, activeColorName, colorSpecificImage,
  imageLoaded, isHovered, computedImageScale, isNovelty, noveltyDaysRemaining,
  highlightColors, activeColorFilter,
  allMatchingVariants, hasMultipleVariants, safeVariantIdx,
  onImageLoad, onVariantChange,
  priority = false,
}: ProductCardImageProps) {
  return (
    <div
      className="relative aspect-[4/5] overflow-hidden product-img-container bg-muted/30"
      style={{ zIndex: 0 }}
      onTouchStart={hasMultipleVariants ? (e) => {
        (e.currentTarget as HTMLElement & { _swipeX?: number })._swipeX = e.touches[0].clientX;
      } : undefined}
      onTouchEnd={hasMultipleVariants ? (e) => {
        const el = e.currentTarget as HTMLElement & { _swipeX?: number };
        const startX = el._swipeX;
        if (startX === null) return;
        const diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) > 40) {
          e.stopPropagation();
          onVariantChange(diff < 0
            ? (safeVariantIdx + 1) % allMatchingVariants.length
            : (safeVariantIdx - 1 + allMatchingVariants.length) % allMatchingVariants.length);
        }
        el._swipeX = undefined;
      } : undefined}
    >
      {/* Image */}
      <OptimizedImage
        src={cardImageUrl}
        alt={activeColorName ? `${product.name} - ${activeColorName}` : product.name}
        title={activeColorName ? `${product.name} - ${activeColorName}` : product.name}
        className={cn(
          "w-full h-full object-contain ease-out",
          hasMultipleVariants ? "transition-all duration-300" : "transition-all duration-700"
        )}
        style={imageLoaded ? { transform: `scale(${computedImageScale})`, willChange: "transform" } : undefined}
        onLoad={onImageLoad}
        containerClassName="h-full w-full"
        priority={priority}
      />

      {/* Active color badge (mobile) */}
      {activeColorName && colorSpecificImage && (
        <div className="absolute top-2 right-2 z-10 sm:hidden">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-card/90 backdrop-blur-sm shadow-sm">{activeColorName}</Badge>
        </div>
      )}

      {/* Hover gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent transition-opacity duration-500", isHovered ? "opacity-100" : "opacity-0")} />

      {/* Featured glow */}
      {product.featured && <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />}

      {/* Badges - Top Left */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1 sm:gap-1.5 z-10">
        {product.featured && (
          <Badge className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow-lg animate-glow-pulse">
            <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
            <span className="hidden sm:inline">Destaque</span><span className="sm:hidden">★</span>
          </Badge>
        )}
        {isNovelty && noveltyDaysRemaining !== undefined ? (
          <NoveltyBadge daysRemaining={noveltyDaysRemaining} size="sm" />
        ) : product.newArrival && (
          <Badge className="bg-gradient-to-r from-info to-info/80 text-info-foreground text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow-md">
            <span className="hidden sm:inline">Novidade</span><span className="sm:hidden">Novo</span>
          </Badge>
        )}
        {product.isKit && (
          <Badge className="bg-gradient-to-r from-warning to-warning/80 text-warning-foreground text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow-md">
            <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />Kit
          </Badge>
        )}
        {product.onSale && (
          <Badge className="bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 shadow-md animate-pulse">
            <span className="hidden sm:inline">Promoção</span><span className="sm:hidden">%</span>
          </Badge>
        )}
      </div>

      {/* Color dots on hover — hidden if multi-variant carousel is active to avoid overlap */}
      {product.colors.length > 0 && !hasMultipleVariants && (
        <div className={cn("absolute bottom-3 left-3 right-3 z-10 transition-all duration-400 ease-out", isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
          <div className="flex items-center gap-1.5 bg-card/95 backdrop-blur-md rounded-full px-3 py-2 shadow-lg border border-border/50">
            {product.colors.slice(0, 6).map((color, idx) => {
              const isDotHighlighted = highlightColors?.includes(color.group) ||
                (activeColorFilter?.groups?.includes(color.groupSlug || '') ?? false) ||
                (activeColorFilter?.variations?.includes(color.variationSlug || '') ?? false);
              return (
                <Tooltip key={idx}>
                  <TooltipTrigger asChild>
                    <div className={cn("w-5 h-5 rounded-full border-2 shadow-sm cursor-pointer transition-all duration-200 hover:scale-125 hover:shadow-md",
                      isDotHighlighted ? "border-success ring-2 ring-success/30 scale-110" : "border-border/50"
                    )} style={{ backgroundColor: color.hex, borderColor: color.hex === '#FFFFFF' ? 'hsl(var(--border))' : undefined }} />
                  </TooltipTrigger>
                  <TooltipContent>{color.name}</TooltipContent>
                </Tooltip>
              );
            })}
            {product.colors.length > 6 && <span className="text-xs font-medium text-muted-foreground ml-1">+{product.colors.length - 6}</span>}
          </div>
        </div>
      )}

      {/* Multi-variant carousel dots */}
      {hasMultipleVariants && (
        <div
          role="tablist"
          aria-label={`Variantes de cor: ${allMatchingVariants.map(v => v.name).join(', ')}`}
          className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-card/95 backdrop-blur-lg rounded-full px-2.5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-border/40 dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onVariantChange((safeVariantIdx + 1) % allMatchingVariants.length); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onVariantChange((safeVariantIdx - 1 + allMatchingVariants.length) % allMatchingVariants.length); }
          }}
        >
          {allMatchingVariants.map((v, i) => (
            <button key={v.groupSlug || v.variationSlug || i} role="tab" type="button"
              tabIndex={i === safeVariantIdx ? 0 : -1} aria-selected={i === safeVariantIdx}
              aria-current={i === safeVariantIdx ? 'true' : undefined}
              onClick={(e) => { e.stopPropagation(); onVariantChange(i); }}
              aria-label={`Ver variante ${v.name}`} title={v.name}
              className={cn("w-5 h-5 rounded-full border-2 transition-all duration-200 hover:scale-125 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                i === safeVariantIdx ? "ring-2 ring-offset-2 ring-offset-card scale-110" : "border-border/50 opacity-70 hover:opacity-100"
              )}
              style={{
                backgroundColor: v.hex,
                borderColor: i === safeVariantIdx ? (isLightColor(v.hex) ? 'hsl(var(--muted-foreground))' : v.hex) : undefined,
                ['--tw-ring-color' as string]: i === safeVariantIdx ? (isLightColor(v.hex) ? 'hsl(var(--muted-foreground) / 0.6)' : v.hex) : undefined,
              }}
            />
          ))}
          <span className="text-[10px] font-medium text-muted-foreground ml-0.5 max-w-[60px] truncate hidden sm:inline" title={allMatchingVariants[safeVariantIdx]?.name}>{allMatchingVariants[safeVariantIdx]?.name}</span>
          <span className="text-[10px] font-medium text-muted-foreground ml-0.5" aria-live="polite">{safeVariantIdx + 1}/{allMatchingVariants.length}</span>
        </div>
      )}
    </div>
  );
});
