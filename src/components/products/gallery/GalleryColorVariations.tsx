/**
 * GalleryColorVariations — Cards de variações de cor abaixo da galeria
 */

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Play, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sortByColorGroup } from "@/utils/colorSorting";
import { getCdnUrl } from "@/utils/image-utils";

interface ColorMedia {
  name: string;
  hex: string;
  sku?: string;
  stock?: number;
  image?: string;
  images?: string[];
  videos?: string[];
}

function ColorThumb({ src, alt, title }: { src: string; alt: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src} alt={alt} title={title}
      className={cn(
        "w-full h-full object-cover transition-all duration-700 ease-out group-hover/color:scale-110",
        loaded ? "opacity-100 blur-0 scale-100" : "opacity-40 blur-sm scale-105"
      )}
      onLoad={() => setLoaded(true)}
      loading="lazy"
    />
  );
}

interface GalleryColorVariationsProps {
  colors: ColorMedia[];
  selectedColorIndex: number;
  onColorSelect: (index: number) => void;
  activeColorName?: string | null;
}

export function GalleryColorVariations({ colors, selectedColorIndex, onColorSelect, activeColorName }: GalleryColorVariationsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortedColors = sortByColorGroup(colors, (c) => c.name, (c) => c.hex);

  // Sync scroll to selected color
  useEffect(() => {
    if (selectedColorIndex >= 0 && scrollRef.current) {
      const container = scrollRef.current;
      const buttons = container.querySelectorAll('button');
      // Find the button that corresponds to the originalIndex
      let targetButton: HTMLButtonElement | null = null;
      
      sortedColors.forEach((color, idx) => {
        const originalIndex = colors.findIndex(c => c.name === color.name && c.sku === color.sku);
        if (originalIndex === selectedColorIndex) {
          targetButton = buttons[idx];
        }
      });

      if (targetButton) {
        const containerWidth = container.offsetWidth;
        const buttonLeft = (targetButton as HTMLButtonElement).offsetLeft;
        const buttonWidth = (targetButton as HTMLButtonElement).offsetWidth;
        
        container.scrollTo({
          left: buttonLeft - (containerWidth / 2) + (buttonWidth / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedColorIndex, sortedColors, colors]);

  const handleColorClick = (originalIndex: number) => {
    onColorSelect(originalIndex);
  };

  return (
    <div className="space-y-3 animate-fade-in mt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Variações ({colors.length})</span>
        <button
          onClick={() => onColorSelect(-1)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full transition-all duration-200",
            selectedColorIndex === -1 || selectedColorIndex === undefined
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          Ver Todas
        </button>
      </div>

      <div className="relative mt-1 group/variations">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: 'none' }}>
          {sortedColors.map((color) => {
            const originalIndex = colors.findIndex(c => c.name === color.name && c.sku === color.sku);
            const hasVideos = color.videos && color.videos.length > 0;
            const isSelected = selectedColorIndex === originalIndex || (activeColorName && color.name === activeColorName);
            const displayStock = color.stock !== undefined ? Math.max(0, color.stock) : undefined;
            const stockStatus = displayStock !== undefined
              ? displayStock === 0 ? { color: "text-destructive", label: "Sem estoque" }
                : displayStock < 100 ? { color: "text-warning", label: "Estoque baixo" }
                  : { color: "text-success", label: "Em estoque" }
              : null;

            return (
              <button
                key={`${color.name}-${color.sku}`}
                onClick={() => handleColorClick(originalIndex)}
                className={cn(
                  "group/color relative shrink-0 w-24 rounded-xl overflow-hidden transition-all duration-300",
                  "bg-card shadow-sm hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1.5"
                )}
                style={{
                  border: isSelected ? `2px solid ${color.hex}` : '1px solid hsl(var(--border))',
                  boxShadow: isSelected ? `0 0 0 3px ${color.hex}30` : undefined
                }}
              >
                <div className="relative aspect-[1/1.05] overflow-hidden">
                  {color.image || color.images?.[0] ? (
                    <ColorThumb
                      src={getCdnUrl(color.images?.[0] || color.image || '', 'thumbnail')}
                      alt={color.name} title={color.name}
                    />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: color.hex }} />
                  )}
                  {hasVideos && (
                    <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: `${color.hex}cc` }}>
                      <Play className="h-3 w-3 text-primary-foreground ml-0.5" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: color.hex }}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </div>

                <div className="p-2 pb-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-white/20 shadow-sm shrink-0" style={{ backgroundColor: color.hex }} />
                    <span className="text-xs font-medium text-foreground truncate">{color.name}</span>
                  </div>
                  {color.sku && <p className="text-[10px] text-muted-foreground font-mono truncate">{color.sku}</p>}
                  {stockStatus && displayStock !== undefined && (
                    <div className="flex items-center gap-1">
                      <Package className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className={cn("text-[10px] font-medium", stockStatus.color)}>
                        {displayStock.toLocaleString("pt-BR")} un.
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Scroll arrows */}
        <Button variant="secondary" size="icon" aria-label="Voltar"
          className={cn(
            "absolute left-0 top-[30%] -translate-y-1/2 z-10 h-10 w-10 rounded-full",
            "bg-card/95 backdrop-blur-md shadow-xl border border-border/50",
            "opacity-0 group-hover/variations:opacity-100 hover:bg-card hover:scale-110 transition-all duration-300"
          )}
          onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
        ><ChevronLeft className="h-5 w-5" /></Button>
        <Button variant="secondary" size="icon" aria-label="Avançar"
          className={cn(
            "absolute right-0 top-[30%] -translate-y-1/2 z-10 h-10 w-10 rounded-full",
            "bg-card/95 backdrop-blur-md shadow-xl border border-border/50",
            "opacity-0 group-hover/variations:opacity-100 hover:bg-card hover:scale-110 transition-all duration-300"
          )}
          onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
        ><ChevronRight className="h-5 w-5" /></Button>
      </div>
    </div>
  );
}
