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
import { memo, useId, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getColorSwatchClasses, resolveSwatchBackground } from '@/components/shared/ColorSwatch';

export interface ColorDotLike {
  name: string;
  hex: string | null;
  /** Imagem específica desta variante (opcional). Quando presente, módulos como
   *  Novidades/Reposição usam para trocar a foto principal ao clicar no swatch. */
  image?: string | null;
  /** Onda 1 Reposição (opcional): estoque atual desta variante. Quando definido,
   *  o swatch aplica overlay visual ("esgotado" / "previsto") e tooltip enriquecido.
   *  Outros callers (Catálogo, Novidades) não passam estes campos — comportamento intacto. */
  stockQty?: number;
  hasUpcomingRestock?: boolean;
  /** ISO date (YYYY-MM-DD) ou null. Mostrado no tooltip quando há reposição prevista. */
  nextRestockDate?: string | null;
}

interface ProductColorSwatchesProps {
  colors: readonly ColorDotLike[] | undefined;
  /** Máximo de bolinhas visíveis antes de mostrar `+N`. Default 5.
   *  Ignorado quando `wrap` é true (exibe todas as cores). */
  max?: number;
  /** Tamanho do dot. Ver tabela na JSDoc do arquivo. */
  size?: 'md' | 'sm' | 'xs';
  className?: string;
  /** Esconde quando vazio. Default true. */
  hideWhenEmpty?: boolean;
  /**
   * Quando true: exibe TODAS as cores em múltiplas linhas (flex-wrap), sem
   * truncar nem mostrar chip "+N". Usado nos cards de grid de Catálogo,
   * Super Filtro, Novidades e Reposição. Default false (legado).
   */
  wrap?: boolean;
  /** Handler de seleção. Recebe a cor e o índice. stopPropagation já aplicado. */
  onSelect?: (color: ColorDotLike, index: number) => void;
  /** Nome da cor atualmente selecionada — recebe ring de destaque. */
  selectedName?: string | null;
  /**
   * Handler opcional de "limpar seleção" (botão "Todos"). Quando definido E
   * existir `selectedName`, é renderizado um chip inline ao lado das bolinhas
   * que dispara o handler. stopPropagation já aplicado.
   */
  onClear?: () => void;
}

const SIZE_CLASS: Record<NonNullable<ProductColorSwatchesProps['size']>, string> = {
  xs: 'h-[var(--swatch-size-xs)] w-[var(--swatch-size-xs)]',
  sm: 'h-[var(--swatch-size-sm)] w-[var(--swatch-size-sm)]',
  md: 'h-[var(--swatch-size-md)] w-[var(--swatch-size-md)]',
};

export const ProductColorSwatches = memo(
  ({
    colors,
    max = 5,
    size = 'sm',
    className,
    hideWhenEmpty = true,
    wrap = false,
    onSelect,
    selectedName,
    onClear,
  }: ProductColorSwatchesProps) => {
    const idPrefix = useId();

    // BUG-PCS-01 FIX (2026-06-21): window.location.search lida inline a cada render sem
    // memoização — recria URLSearchParams desnecessariamente e não reage a mudanças de URL.
    // DEVE ficar antes dos early returns para respeitar Rules of Hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads URL once per mount; selectedName drives reactive updates
    const urlColor = useMemo(() => {
      if (typeof window === 'undefined') return null;
      return new URLSearchParams(window.location.search).get('cor')?.toLowerCase() ?? null;
    }, []);

    if (colors === undefined) {
      return (
        <div
          className={cn(
            'flex min-h-[var(--swatch-size-sm)] flex-wrap items-center gap-x-[var(--swatch-gap-x)] gap-y-[var(--swatch-gap-y)] py-[var(--swatch-container-py)]',
            className,
          )}
          aria-busy="true"
          aria-label="Carregando opções de cores"
          data-testid="colors-loading-skeleton"
        >
          {Array.from({ length: 6 }, (_, i) => (
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
            className={cn(
              'min-h-[var(--swatch-size-sm)] py-[var(--swatch-container-py)]',
              className,
            )}
            data-testid="colors-empty-hidden"
          />
        );
      }
      return (
        <div
          className="flex min-h-[var(--swatch-size-sm)] items-center gap-1 py-[var(--swatch-container-py)] opacity-40"
          role="status"
          aria-live="polite"
          data-testid="colors-unavailable"
        >
          <div className="h-1 w-2 rounded-full bg-muted-foreground/30" />
          <span className="text-[9px] font-medium tracking-tight">N/A</span>
        </div>
      );
    }

    // Trunca para `max` swatches e expõe `+N` chip quando há excedente.
    // Em modo `wrap`, exibe todas as cores sem chip de overflow.
    const effectiveMax = wrap ? colors.length : Math.max(1, max);
    const overflow = wrap ? 0 : Math.max(0, colors.length - effectiveMax);
    const visible = overflow > 0 ? colors.slice(0, effectiveMax) : colors;

    const normalizedSelected = (selectedName || urlColor)?.toLowerCase() ?? null;

    return (
      <div
        className={cn(
          wrap
            ? // Modo wrap: múltiplas linhas, altura automática, sem clipping nas bordas.
              //  px-[2px] reserva espaço para o ring/glow do swatch selecionado sem cortar.
              'flex min-h-[var(--swatch-size-sm)] flex-wrap items-center gap-x-[var(--swatch-gap-x)] gap-y-[var(--swatch-gap-y)] px-[2px] py-[var(--swatch-container-py)]'
            : // Modo legado: uma única linha + chip "+N".
              'flex h-[var(--swatch-size-sm)] max-h-[var(--swatch-size-sm)] min-h-[var(--swatch-size-sm)] flex-nowrap items-center gap-x-[var(--swatch-gap-x)] overflow-hidden py-[var(--swatch-container-py)]',
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

          // Onda 1: estado de estoque opcional por cor (somente Reposição passa esses campos)
          const hasStockInfo = typeof c.stockQty === 'number';
          const isOutOfStock = hasStockInfo && c.stockQty === 0 && !c.hasUpcomingRestock;
          const isUpcoming = hasStockInfo && c.stockQty === 0 && c.hasUpcomingRestock === true;
          const formattedRestock = c.nextRestockDate
            ? new Date(`${c.nextRestockDate}T00:00:00`).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })
            : null;

          return (
            // BUG-PCS-02 FIX (2026-06-21): chave composta name+idx é instável ao reordenar.
            // Nome da cor é único por produto; chave estável evita re-mounts desnecessários.
            <Tooltip key={c.name}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  className={cn(
                    // SSOT visual: base + estados out-of-stock/active (compartilhado com Estoque)
                    getColorSwatchClasses({ isActive: isSelected, isOutOfStock, hasBg: true }),
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    isSelected
                      ? 'scale-[var(--swatch-scale-hover)] opacity-100 ring-[var(--swatch-ring-width)] after:absolute after:inset-[-1px] after:rounded-full after:shadow-[0_0_12px_2px_hsl(var(--primary)/0.5)] after:content-[""]'
                      : !isOutOfStock &&
                          'opacity-90 hover:z-10 hover:scale-[var(--swatch-scale-hover)] hover:opacity-100',
                    SIZE_CLASS[size],
                  )}

                  style={{ backgroundColor: resolveSwatchBackground(c.hex, c.name).background ?? 'transparent' }}
                  aria-label={
                    isOutOfStock
                      ? `Opção de cor: ${c.name} — esgotada`
                      : isUpcoming
                        ? `Opção de cor: ${c.name} — reposição prevista${formattedRestock ? ` em ${formattedRestock}` : ''}`
                        : `Opção de cor: ${c.name}`
                  }

                  aria-describedby={tooltipId}
                  aria-checked={isSelected}
                  data-testid={`color-swatch-${c.name.toLowerCase().replace(/\s+/g, '-')}`}
                  data-color-name={c.name}
                  data-stock-state={
                    !hasStockInfo
                      ? undefined
                      : isOutOfStock
                        ? 'out'
                        : isUpcoming
                          ? 'upcoming'
                          : 'in-stock'
                  }
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
                >
                  {/* Badge de reposição prevista (somente Onda 1, quando isUpcoming) */}
                  {isUpcoming && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-[7px] w-[7px] items-center justify-center rounded-full bg-[hsl(var(--info))] ring-1 ring-background"
                      data-testid="swatch-upcoming-dot"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent
                id={tooltipId}
                side="top"
                className="p-2 text-xs"
                role="tooltip"
                data-testid="color-tooltip-content"
              >
                <span className="font-bold">{c.name}</span>
                {hasStockInfo && (
                  <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                    {isOutOfStock
                      ? 'Esgotado'
                      : isUpcoming
                        ? `Esgotado · reposição${formattedRestock ? ` em ${formattedRestock}` : ' prevista'}`
                        : `${c.stockQty?.toLocaleString('pt-BR')} un. em estoque`}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-none text-muted-foreground',
              SIZE_CLASS[size],
            )}
            aria-label={`Mais ${overflow} cor${overflow === 1 ? '' : 'es'}`}
            data-testid="color-swatches-overflow"
            title={`+${overflow}`}
          >
            +{overflow}
          </span>
        )}
        {onClear && normalizedSelected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }
            }}
            aria-label="Mostrar todas as variações"
            data-testid="color-swatches-clear"
            className="ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Todos
          </button>
        )}
      </div>
    );
  },
);
