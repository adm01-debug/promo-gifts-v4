/**
 * GalleryColorVariations — Cards de variações de cor abaixo da galeria
 */

import { useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play, Package } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ColorTooltipContent, colorTooltipClassName } from '../ColorTooltipContent';
import { sortByColorGroup } from '@/utils/colorSorting';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { getProxiedImageUrl } from '@/utils/imageProxy';

interface ColorMedia {
  name: string;
  hex: string;
  sku?: string;
  stock?: number;
  image?: string;
  images?: string[];
  videos?: string[];
}

interface GalleryColorVariationsProps {
  colors: ColorMedia[];
  selectedColorIndex: number;
  onColorSelect: (index: number) => void;
  activeColorName?: string | null;
}

export function GalleryColorVariations({
  colors,
  selectedColorIndex,
  onColorSelect,
  activeColorName,
}: GalleryColorVariationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortedColors = useMemo(
    () =>
      sortByColorGroup(
        colors,
        (c) => c.name,
        (c) => c.hex,
      ),
    [colors],
  );

  // Sync scroll to selected color
  useEffect(() => {
    if (selectedColorIndex >= 0 && scrollRef.current) {
      const container = scrollRef.current;
      const buttons = container.querySelectorAll('button');
      // Find the button that corresponds to the originalIndex
      let targetButton: HTMLButtonElement | null = null;

      sortedColors.forEach((color, idx) => {
        const originalIndex = colors.findIndex((c) => c.name === color.name && c.sku === color.sku);
        if (originalIndex === selectedColorIndex) {
          targetButton = buttons[idx];
        }
      });

      if (targetButton) {
        const containerWidth = container.offsetWidth;
        const buttonLeft = (targetButton as HTMLButtonElement).offsetLeft;
        const buttonWidth = (targetButton as HTMLButtonElement).offsetWidth;

        container.scrollTo({
          left: buttonLeft - containerWidth / 2 + buttonWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [selectedColorIndex, sortedColors, colors]);

  const handleColorClick = (originalIndex: number) => {
    onColorSelect(originalIndex);
  };

  return (
    <div className="mt-4 animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Variações ({colors.length})
        </span>
        <button
          onClick={() => onColorSelect(-1)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs transition-all duration-200',
            selectedColorIndex === -1 || selectedColorIndex === undefined
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          )}
        >
          Ver Todas
        </button>
      </div>

      <div className="group/variations relative mt-1">
        <div
          ref={scrollRef}
          className="scrollbar-thin flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {sortedColors.map((color) => {
            const originalIndex = colors.findIndex(
              (c) => c.name === color.name && c.sku === color.sku,
            );
            const hasVideos = color.videos && color.videos.length > 0;
            const isSelected =
              selectedColorIndex === originalIndex ||
              (activeColorName && color.name === activeColorName);
            const displayStock = color.stock !== undefined ? Math.max(0, color.stock) : undefined;
            const stockStatus =
              displayStock !== undefined
                ? displayStock === 0
                  ? { color: 'text-destructive', label: 'Estoque zerado' }
                  : displayStock < 100
                    ? { color: 'text-warning', label: 'Estoque baixo' }
                    : { color: 'text-success', label: 'Em estoque' }
                : null;

            return (
              <button
                key={`${color.name}-${color.sku}`}
                onClick={() => handleColorClick(originalIndex)}
                className={cn(
                  'group/color relative w-24 shrink-0 overflow-hidden rounded-xl transition-all duration-300',
                  'bg-card shadow-sm hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10',
                )}
                style={{
                  border: isSelected ? `2px solid ${color.hex}` : '1px solid hsl(var(--border))',
                  boxShadow: isSelected ? `0 0 0 3px ${color.hex}30` : undefined,
                }}
              >
                <div className="relative aspect-[1/1.05] overflow-hidden">
                  {color.image || color.images?.[0] ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-full w-full">
                          <OptimizedImage
                            src={getCdnUrl(color.images?.[0] || color.image || '', 'thumbnail')}
                            urlOriginal={getProxiedImageUrl(color.images?.[0] || color.image || '') ?? null}
                            alt={color.name}
                            className="object-cover transition-transform duration-700 ease-out group-hover/color:scale-110"
                            containerClassName="h-full w-full"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8} className={colorTooltipClassName}>
                        <ColorTooltipContent colorName={color.name} colorHex={color.hex} />
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div className="h-full w-full" style={{ backgroundColor: color.hex }} />
                  )}
                  {hasVideos && (
                    <div
                      className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full shadow-lg"
                      style={{ backgroundColor: `${color.hex}cc` }}
                    >
                      <Play className="ml-0.5 h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {isSelected && (
                    <div
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full shadow-lg"
                      style={{ backgroundColor: color.hex }}
                    >
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>

                <div className="space-y-1 p-2 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate text-xs font-medium text-foreground">
                      {color.name}
                    </span>
                  </div>
                  {color.sku && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {color.sku}
                    </p>
                  )}
                  {stockStatus && displayStock !== undefined && (
                    <div className="flex items-center gap-1">
                      <Package className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className={cn('text-[10px] font-medium', stockStatus.color)}>
                        {displayStock.toLocaleString('pt-BR')} un.
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scroll arrows */}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Voltar"
          className={cn(
            'absolute left-0 top-[30%] z-10 h-10 w-10 -translate-y-1/2 rounded-full',
            'border border-border/50 bg-card/95 shadow-xl backdrop-blur-md',
            'opacity-0 transition-all duration-300 hover:scale-110 hover:bg-card group-hover/variations:opacity-100',
          )}
          onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Avançar"
          className={cn(
            'absolute right-0 top-[30%] z-10 h-10 w-10 -translate-y-1/2 rounded-full',
            'border border-border/50 bg-card/95 shadow-xl backdrop-blur-md',
            'opacity-0 transition-all duration-300 hover:scale-110 hover:bg-card group-hover/variations:opacity-100',
          )}
          onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
