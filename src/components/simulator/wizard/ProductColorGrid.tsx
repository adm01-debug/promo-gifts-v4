/**
 * ProductColorGrid - Exibe as cores/variantes do produto selecionado
 *
 * Grid visual com swatches de cores, similar ao gerador de mockups.
 */

import { Badge } from '@/components/ui/badge';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductColorVariant } from '@/types/domain/simulator-wizard';

interface ProductColorGridProps {
  colors: ProductColorVariant[];
  className?: string;
}

export function ProductColorGrid({ colors, className }: ProductColorGridProps) {
  if (!colors || colors.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Cores disponíveis</span>
        <Badge variant="secondary" className="h-5 text-[10px]">
          {colors.length}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <div
            key={color.code || color.name}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-2.5 py-1.5"
            title={`${color.name}${color.stock !== undefined ? ` • ${color.stock} un.` : ''}`}
          >
            <div
              className="h-4 w-4 shrink-0 rounded-full border border-border/60"
              style={{ backgroundColor: color.hex || '#CCCCCC' }}
            />
            <span className="max-w-[80px] truncate text-xs font-medium">{color.name}</span>
            {color.stock !== undefined && color.stock > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {color.stock >= 1000 ? `${(color.stock / 1000).toFixed(1)}k` : color.stock}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
