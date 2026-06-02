/**
 * ProductColorSwatches — Renderiza bolinhas inline com as cores disponíveis
 * de um produto. Padrão visual usado em todas as visualizações (grid/lista/tabela)
 * de Catálogo, Super Filtro, Novidades, Reposição e Estoque.
 */
import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ColorDotLike {
  name: string;
  hex: string | null;
}

interface ProductColorSwatchesProps {
  colors: readonly ColorDotLike[] | undefined;
  /** Máximo de bolinhas visíveis antes de mostrar `+N`. Default 5. */
  max?: number;
  /** Tamanho do dot. */
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  /** Esconde quando vazio. Default true. */
  hideWhenEmpty?: boolean;
}

const SIZE_CLASS: Record<NonNullable<ProductColorSwatchesProps['size']>, string> = {
  xs: 'h-2.5 w-2.5',
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
};

export const ProductColorSwatches = memo(function ProductColorSwatches({
  colors,
  max = 5,
  size = 'sm',
  className,
  hideWhenEmpty = true,
}: ProductColorSwatchesProps) {
  if (!colors || colors.length === 0) {
    return hideWhenEmpty ? null : (
      <span className="text-[10px] text-muted-foreground/60">—</span>
    );
  }

  const visible = colors.slice(0, max);
  const overflow = colors.length - visible.length;

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="list"
      aria-label={`${colors.length} cor${colors.length === 1 ? '' : 'es'} disponível${colors.length === 1 ? '' : 'is'}`}
    >
      {visible.map((c, idx) => (
        <Tooltip key={`${c.name}-${idx}`}>
          <TooltipTrigger asChild>
            <span
              role="listitem"
              className={cn(
                'inline-block rounded-full border border-border/60 shadow-sm',
                SIZE_CLASS[size],
              )}
              style={{ backgroundColor: c.hex || 'transparent' }}
              aria-label={c.name}
            />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {c.name}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="ml-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
              aria-label={`mais ${overflow} cor${overflow === 1 ? '' : 'es'}`}
            >
              +{overflow}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {colors.slice(max).map((c) => c.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
