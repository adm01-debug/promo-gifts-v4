/**
 * ProductColorSwatches — Renderiza bolinhas inline com as cores disponíveis
 * de um produto. Padrão visual usado em todas as visualizações (grid/lista/tabela)
 * de Catálogo, Super Filtro, Novidades, Reposição e Estoque.
 */
import { memo, useMemo } from 'react';
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
  const idPrefix = useMemo(() => Math.random().toString(36).substring(2, 11), []);

  // Container principal com data-testid constante para asserts de skeleton vs conteúdo
  const containerTestId = "product-colors-wrapper";

  if (colors === undefined) {
    return (
      <div 
        className={cn('flex items-center gap-1 min-h-[16px]', className)} 
        aria-busy="true" 
        aria-label="Carregando opções de cores"
        data-testid="colors-loading-skeleton"
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'animate-pulse rounded-full bg-muted',
              SIZE_CLASS[size]
            )}
            data-testid="color-skeleton-dot"
          />
        ))}
      </div>
    );
  }

  if (colors.length === 0) {
    if (hideWhenEmpty) return <div className="min-h-[16px]" data-testid="colors-empty-hidden" />;
    return (
      <span 
        className="text-[10px] text-muted-foreground/60 italic min-h-[16px] flex items-center"
        role="status"
        aria-live="polite"
        data-testid="colors-unavailable"
      >
        Cores indisponíveis
      </span>
    );
  }

  const visible = colors.slice(0, max);
  const overflow = colors.length - visible.length;

  return (
    <div
      className={cn('flex items-center gap-0.5 min-h-[16px]', className)}
      role="group"
      aria-live="polite"
      aria-label={`${colors.length} cor${colors.length === 1 ? '' : 'es'} disponível${colors.length === 1 ? '' : 'is'}`}
      data-testid="product-colors-container"
    >
      {visible.map((c, idx) => {
        const tooltipId = `tooltip-color-${idPrefix}-${idx}`;
        return (
          <Tooltip key={`${c.name}-${idx}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-block rounded-full border border-border/60 shadow-sm transition-transform hover:scale-110 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  SIZE_CLASS[size],
                )}
                style={{ backgroundColor: c.hex || 'transparent' }}
                aria-label={`Opção de cor: ${c.name}`}
                aria-describedby={tooltipId}
                data-testid={`color-swatch-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
              />
            </TooltipTrigger>
            <TooltipContent 
              id={tooltipId} 
              side="top" 
              className="text-xs" 
              role="tooltip"
              data-testid="color-tooltip-content"
            >
              {c.name}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ml-0.5 text-[10px] font-medium tabular-nums text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded-sm px-0.5"
              aria-label={`Ver mais ${overflow} cor${overflow === 1 ? '' : 'es'}`}
              data-testid="color-swatch-overflow"
            >
              +{overflow}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs" role="tooltip" data-testid="color-overflow-tooltip">
            {colors.slice(max).map((c) => c.name).join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
