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
import { memo, useId } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ColorDotLike {
  name: string;
  hex: string | null;
  /** Imagem específica desta variante (opcional). Quando presente, módulos como
   *  Novidades/Reposição usam para trocar a foto principal ao clicar no swatch. */
  image?: string | null;
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
  // `max` permanece na interface (API pública) mas não é mais consumido —
  // main passou a exibir todas as cores; não desestruturado p/ evitar no-unused-vars.
  size = 'sm',
  className,
  hideWhenEmpty = true,
  onSelect,
  selectedName,
}: ProductColorSwatchesProps) {
  const idPrefix = useId();

  if (colors === undefined) {
    return (
      <div
        className={cn(
          'flex min-h-[var(--swatch-size-sm)] flex-wrap items-center gap-x-[var(--swatch-gap-x)] gap-y-[var(--swatch-gap-y)]',
          className,
        )}
        aria-busy="true"
        aria-label="Carregando opções de cores"
        data-testid="colors-loading-skeleton"
      >
        {[...Array(6)].map((_, i) => (
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
      return (
        <div
          className={cn('min-h-[var(--swatch-size-sm)]', className)}
          data-testid="colors-empty-hidden"
        />
      );
    }
    return (
      <div
        className="flex min-h-[var(--swatch-size-sm)] items-center gap-1 opacity-40"
        role="status"
        aria-live="polite"
        data-testid="colors-unavailable"
      >
        <div className="h-1 w-2 rounded-full bg-muted-foreground/30" />
        <span className="text-[9px] font-medium tracking-tight">N/A</span>
      </div>
    );
  }

  const visible = colors;
  // Resolve o estado selecionado o mais cedo possível
  const queryParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlColor = queryParams?.get('cor')?.toLowerCase() ?? null;
  const normalizedSelected = (selectedName || urlColor)?.toLowerCase() ?? null;

  return (
    <div
      className={cn(
        'flex min-h-[var(--swatch-size-sm)] flex-wrap items-center gap-x-[var(--swatch-gap-x)] gap-y-[var(--swatch-gap-y)] overflow-visible py-[var(--swatch-container-py)]',
        className,
      )}
      role="radiogroup"
      aria-live="polite"
      aria-label={`${colors.length} cor${colors.length === 1 ? '' : 'es'} disponív${
        colors.length === 1 ? 'el' : 'eis'
      }`}
      data-testid="product-colors-container"
    >
      {visible.map((c, idx) => {
        const tooltipId = `tooltip-color-${idPrefix}-${idx}`;
        const isSelected =
          normalizedSelected !== null && c.name.toLowerCase() === normalizedSelected;
        return (
          <Tooltip key={`${c.name}-${idx}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="radio"
                className={cn(
                  'relative inline-block rounded-full border border-border/40 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isSelected
                    ? 'z-10 scale-[var(--swatch-scale-hover)] opacity-100 ring-[var(--swatch-ring-width)] ring-primary ring-offset-1 after:absolute after:inset-[-1px] after:rounded-full after:shadow-[0_0_12px_2px_hsl(var(--primary)/0.5)] after:content-[""]'
                    : 'opacity-90 hover:z-10 hover:scale-[var(--swatch-scale-hover)] hover:opacity-100',
                  SIZE_CLASS[size],
                )}
                style={{ backgroundColor: c.hex || 'transparent' }}
                aria-label={`Opção de cor: ${c.name}`}
                aria-describedby={tooltipId}
                aria-checked={isSelected}
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
              className="p-2 text-xs"
              role="tooltip"
              data-testid="color-tooltip-content"
            >
              <span className="font-bold">{c.name}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
