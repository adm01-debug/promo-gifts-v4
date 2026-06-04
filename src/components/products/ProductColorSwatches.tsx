/**
 * ProductColorSwatches — Renderiza bolinhas inline com as cores disponíveis
 * de um produto. Padrão visual usado em todas as visualizações (grid/lista/tabela)
 * de Catálogo, Super Filtro, Novidades, Reposição e Estoque.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  HIERARQUIA VISUAL & TAMANHOS RESPONSIVOS (SSOT)
 * ──────────────────────────────────────────────────────────────────────────────
 *  Os swatches ficam SEMPRE abaixo do `<h3 product-card-name>` e ACIMA do bloco
 *  de preço/estoque. A linha tem `min-h-[16px]` reservado mesmo no estado vazio,
 *  garantindo que o preço nunca "salte" verticalmente entre cards.
 *
 *  Tamanho dos dots por preset (use `size`):
 *    - `xs`  → h-2.5 w-2.5 (10×10px) — densidades muito apertadas (Novidades cards-2)
 *    - `sm`  → h-[17px] w-[17px] (aprox. 12px + 40%) — DEFAULT, usado no grid de Catálogo
 *    - `md`  → h-[22px] w-[22px] (aprox. 16px + 40%) — listas e tabelas
 *
 *  Espaçamento horizontal: `gap-0.5` (2px) entre dots — mantém alinhamento óptico
 *  com o `+N` overflow (`text-[10px]`) sem competir com o nome (sm:text-base) e
 *  o preço (text-xs / sm:text-lg).
 *
 *  Limite default `max=5`; no ProductCard do grid usamos `max=6` (cabe sem
 *  quebrar a linha mesmo no mobile mais estreito 320px).
 * ──────────────────────────────────────────────────────────────────────────────
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
  /** Tamanho do dot. Ver tabela na JSDoc do arquivo. */
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  /** Esconde quando vazio. Default true. */
  hideWhenEmpty?: boolean;
  /**
   * Handler disparado ao clicar/teclar Enter numa bolinha.
   * Recebe a cor selecionada. Sempre chamado com `event.stopPropagation()`
   * já aplicado (evita ativar o onClick do card pai).
   */
  onSelect?: (color: ColorDotLike, index: number) => void;
  /** Nome da cor atualmente selecionada — recebe ring de destaque. */
  selectedName?: string | null;
}

const SIZE_CLASS: Record<NonNullable<ProductColorSwatchesProps['size']>, string> = {
  xs: 'h-[var(--swatch-size-xs)] w-[var(--swatch-size-xs)]',
  sm: 'h-[var(--swatch-size-sm)] w-[var(--swatch-size-sm)]',
  md: 'h-[var(--swatch-size-md)] w-[var(--swatch-size-md)]',
};

export const ProductColorSwatches = memo(function ProductColorSwatches({
  colors,
  max = 5,
  size = 'sm',
  className,
  hideWhenEmpty = true,
  onSelect,
  selectedName,
}: ProductColorSwatchesProps) {
  const idPrefix = useMemo(() => Math.random().toString(36).substring(2, 11), []);

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
            className={cn('animate-pulse rounded-full bg-muted', SIZE_CLASS[size])}
            data-testid="color-skeleton-dot"
          />
        ))}
      </div>
    );
  }

  if (colors.length === 0) {
    if (hideWhenEmpty) {
      return <div className={cn('min-h-[16px]', className)} data-testid="colors-empty-hidden" />;
    }
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
  const normalizedSelected = selectedName?.toLowerCase() ?? null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-[var(--swatch-gap)] min-h-[var(--swatch-size-md)]', className)}
      role="group"
      aria-live="polite"
      aria-label={`${colors.length} cor${colors.length === 1 ? '' : 'es'} disponív${
        colors.length === 1 ? 'el' : 'eis'
      }`}
      data-testid="product-colors-container"
    >
      {visible.map((c, idx) => {
        const tooltipId = `tooltip-color-${idPrefix}-${idx}`;
        const isSelected = normalizedSelected !== null && c.name.toLowerCase() === normalizedSelected;
        return (
          <Tooltip key={`${c.name}-${idx}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-block rounded-full border border-border/60 shadow-sm transition-transform hover:scale-110 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                  isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-110',
                  SIZE_CLASS[size],
                )}
                style={{ backgroundColor: c.hex || 'transparent' }}
                aria-label={`Opção de cor: ${c.name}`}
                aria-describedby={tooltipId}
                aria-pressed={isSelected || undefined}
                data-testid={`color-swatch-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                data-color-name={c.name}
                onClick={(e) => {
                  if (!onSelect) return;
                  e.stopPropagation();
                  onSelect(c, idx);
                }}
                onKeyDown={(e) => {
                  if (!onSelect) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(c, idx);
                  }
                }}
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
              className="ml-0.5 text-[12px] font-bold tabular-nums text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded-sm px-0.5"
              aria-label={`Ver mais ${overflow} cor${overflow === 1 ? '' : 'es'}`}
              data-testid="color-swatch-overflow"
              onClick={(e) => {
                // Ao clicar no +N sem uma cor específica, navegamos para o PDP padrão
                // O evento de clique do card pai cuidará da navegação se não pararmos aqui.
                // Mas queremos permitir que o usuário veja a lista primeiro.
                e.stopPropagation();
              }}
            >
              +{overflow}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex flex-col gap-1.5 p-2" role="tooltip" data-testid="color-overflow-tooltip">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1 border-b border-border/40 pb-1">
              Mais {overflow} cor{overflow === 1 ? '' : 'es'}
            </p>
            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
              {colors.slice(max).map((c, idx) => (
                <button
                  key={`${c.name}-${idx}`}
                  type="button"
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted text-[11px] transition-colors text-left"
                  data-testid={`color-swatch-hidden-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={(e) => {
                    if (!onSelect) return;
                    e.stopPropagation();
                    onSelect(c, max + idx);
                  }}
                >
                  <div 
                    className="h-2.5 w-2.5 rounded-full border border-border/40" 
                    style={{ backgroundColor: c.hex || 'transparent' }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
