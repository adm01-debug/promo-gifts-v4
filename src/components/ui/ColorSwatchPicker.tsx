import React from 'react';
import { cn } from '@/lib/utils';
import type { ColorSwatch } from '@/hooks/useProductColorSwatch';

interface ColorSwatchPickerProps {
  swatches: ColorSwatch[];
  activeVariantId: string | null;
  onSelect: (variantId: string) => void;
  onReset: () => void;
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function ColorSwatchPicker({
  swatches,
  activeVariantId,
  onSelect,
  onReset,
  maxVisible = 8,
  size = 'md',
  className,
}: ColorSwatchPickerProps) {
  if (!swatches || swatches.length === 0) return null;

  const dotPx = size === 'sm' ? 16 : 20;
  const visible = swatches.slice(0, maxVisible);
  const overflow = swatches.length - maxVisible;

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
      {/* Botão Todos — aparece apenas quando há seleção ativa */}
      {activeVariantId !== null && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          className="text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Ver todas as cores"
        >
          Todos
        </button>
      )}

      {visible.map((swatch) => {
        const isActive = activeVariantId === swatch.variant_id;
        const isOut = !swatch.is_in_stock;
        return (
          <button
            key={swatch.variant_id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(swatch.variant_id); }}
            className={cn(
              'rounded-full border-2 transition-all duration-150 cursor-pointer relative flex-shrink-0',
              isActive
                ? 'border-primary scale-110 shadow-sm ring-1 ring-primary ring-offset-1'
                : 'border-transparent hover:border-muted-foreground/40 hover:scale-105',
              isOut && 'opacity-40'
            )}
            style={{ backgroundColor: swatch.color_hex ?? '#e5e5e5', width: dotPx, height: dotPx }}
            title={`${swatch.color_name}${
              isOut
                ? ' (sem estoque)'
                : ` — ${swatch.stock_quantity.toLocaleString('pt-BR')} un.`
            }`}
            aria-label={swatch.color_name}
            aria-pressed={isActive}
          >
            {isOut && (
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg,transparent 45%,rgba(200,200,200,0.75) 45%,rgba(200,200,200,0.75) 55%,transparent 55%)',
                }}
              />
            )}
          </button>
        );
      })}

      {overflow > 0 && (
        <span className="text-xs text-muted-foreground font-medium">+{overflow}</span>
      )}
    </div>
  );
}
