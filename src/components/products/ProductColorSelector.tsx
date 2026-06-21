import { useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/hooks/products/useColorSystem';
import { ColorTooltipContent, colorTooltipClassName } from './ColorTooltipContent';

// =====================================================
// TIPOS
// =====================================================

export interface ProductColor {
  id?: string;
  name: string;
  hex: string;
  variationName?: string; // "Azul Royal"
  nuanceName?: string; // "Metalizado"
  groupName?: string; // "Azul"
  groupHex?: string; // Para fallback
}

interface ProductColorSelectorProps {
  colors: ProductColor[];
  selectedColorId?: string | null;
  onColorSelect?: (color: ProductColor) => void;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

const COLOR_SELECTOR_SWATCH_CLASSES = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
} as const;

const COLOR_SELECTOR_CHECK_CLASSES = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
} as const;

const COMPACT_DOT_SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
} as const;

// BUG-PCS-03 FIX (2026-06-21): formatColorName definida dentro do componente era
// recriada a cada render. Função pura sem closure — pertence ao escopo do módulo.
const formatColorName = (color: ProductColor) => {
  if (color.variationName && color.nuanceName) {
    return `${color.variationName} ${color.nuanceName}`;
  }
  if (color.variationName) {
    return color.variationName;
  }
  return color.name;
};

export function ProductColorSelector({
  colors,
  selectedColorId,
  onColorSelect,
  maxVisible = 8,
  size = 'md',
  showLabel = true,
  className,
}: ProductColorSelectorProps) {
  const [hoveredColor, setHoveredColor] = useState<ProductColor | null>(null);

  const visibleColors = colors.slice(0, maxVisible);
  const hiddenCount = colors.length - maxVisible;

  const selectedColor = colors.find((c) => c.id === selectedColorId);
  const displayColor = hoveredColor || selectedColor;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Label com nome da cor selecionada */}
      {showLabel && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Cores disponíveis ({colors.length})</p>
          <AnimatePresence mode="wait">
            {displayColor && (
              <motion.span
                key={displayColor.id || displayColor.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ backgroundColor: displayColor.hex }}
                />
                {formatColorName(displayColor)}
                {displayColor.nuanceName && <Sparkles className="h-3 w-3 text-primary/60" />}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {visibleColors.map((color) => {
          const isSelected = selectedColorId === color.id;
          const colorHex = color.hex || color.groupHex || '#CCCCCC';
          const isLight = isLightColor(colorHex);
          const isWhite = colorHex.toUpperCase() === '#FFFFFF' || colorHex.toUpperCase() === '#FFF';

          return (
            // BUG-PCS-04 FIX (2026-06-21): key={color.id || idx} é instável quando
            // color.id é undefined (chave vira idx e muda ao reordenar). Usar id ?? composite estável.
            <Tooltip key={color.id ?? `${color.name}-${color.hex}`}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => onColorSelect?.(color)}
                  onMouseEnter={() => setHoveredColor(color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  className={cn(
                    'relative cursor-pointer rounded-full',
                    'transition-all duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    COLOR_SELECTOR_SWATCH_CLASSES[size],
                    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  style={{
                    backgroundColor: colorHex,
                    border: isWhite ? '2px solid hsl(var(--border))' : '2px solid transparent',
                    boxShadow: isSelected
                      ? `0 0 12px 3px ${colorHex}80, 0 0 20px 6px ${colorHex}40`
                      : undefined,
                  }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  animate={
                    isSelected
                      ? {
                          boxShadow: [
                            `0 0 12px 3px ${colorHex}80, 0 0 20px 6px ${colorHex}40`,
                            `0 0 16px 5px ${colorHex}90, 0 0 24px 8px ${colorHex}50`,
                            `0 0 12px 3px ${colorHex}80, 0 0 20px 6px ${colorHex}40`,
                          ],
                        }
                      : {}
                  }
                  transition={
                    isSelected
                      ? {
                          boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                        }
                      : {}
                  }
                >
                  {/* Check mark para cor selecionada */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <Check
                          className={cn(
                            COLOR_SELECTOR_CHECK_CLASSES[size],
                            isLight ? 'text-foreground' : 'text-primary-foreground',
                          )}
                          strokeWidth={3}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="top" className={colorTooltipClassName}>
                <div className="text-center">
                  <ColorTooltipContent colorName={formatColorName(color)} colorHex={colorHex} />
                  {color.groupName && color.groupName !== color.variationName && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground opacity-80">
                      Grupo: {color.groupName}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Indicador de cores extras */}
        {hiddenCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                className={cn(
                  'flex items-center justify-center rounded-full bg-muted',
                  'cursor-default text-xs font-semibold text-muted-foreground',
                  COLOR_SELECTOR_SWATCH_CLASSES[size],
                )}
                whileHover={{ scale: 1.05 }}
              >
                +{hiddenCount}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              Mais {hiddenCount} {hiddenCount === 1 ? 'cor' : 'cores'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nome da cor selecionada abaixo dos swatches */}
      <AnimatePresence mode="wait">
        {selectedColor && (
          <motion.div
            key={selectedColor.id || selectedColor.name}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 pt-1"
          >
            <span
              className="h-4 w-4 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: selectedColor.hex }}
            />
            <span className="text-sm font-medium text-foreground">
              {formatColorName(selectedColor)}
            </span>
            {selectedColor.nuanceName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                {selectedColor.nuanceName}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// VERSÃO COMPACTA PARA CARDS
// =====================================================

interface CompactColorDotsProps {
  colors: ProductColor[];
  maxVisible?: number;
  size?: 'xs' | 'sm';
}

export function CompactColorDots({ colors, maxVisible = 5, size = 'sm' }: CompactColorDotsProps) {
  const visibleColors = colors.slice(0, maxVisible);
  const hiddenCount = colors.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      {visibleColors.map((color) => (
        <Tooltip key={color.id ?? `${color.name}-${color.hex}`}>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'rounded-full border',
                COMPACT_DOT_SIZE_CLASSES[size],
                color.hex?.toUpperCase() === '#FFFFFF' ? 'border-border' : 'border-transparent',
              )}
              style={{ backgroundColor: color.hex || '#CCCCCC' }}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className={colorTooltipClassName}>
            <ColorTooltipContent
              colorName={`${color.variationName || color.name}${color.nuanceName ? ` ${color.nuanceName}` : ''}`}
              colorHex={color.hex || '#CCCCCC'}
            />
          </TooltipContent>
        </Tooltip>
      ))}
      {hiddenCount > 0 && (
        <span className="text-xs font-medium text-muted-foreground">+{hiddenCount}</span>
      )}
    </div>
  );
}
