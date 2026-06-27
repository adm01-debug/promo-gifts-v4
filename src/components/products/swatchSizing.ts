/**
 * SSOT do dimensionamento PROPORCIONAL das bolinhas de cor por contexto de
 * visualização. A bolinha escala conforme o modo (Grid / Lista / Tabela) e,
 * no Grid, conforme a densidade de colunas — Grid largo (poucas colunas) =>
 * bolinha maior; Grid denso (muitas colunas) => bolinha menor; Lista menor;
 * Tabela menor ainda.
 *
 * Mecanismo: o container de cada módulo (Catálogo / Novidades / Reposição)
 * seta a CSS var `--swatch-size` via `swatchSizeStyle(...)`. O `ProductColorSwatches`
 * lê `var(--swatch-size, var(--swatch-size-<token>))`, então o container dita o
 * tamanho de TODAS as bolinhas internas sem props extras nos cards.
 */
import type { CSSProperties } from 'react';
import type { ColumnCount } from '@/components/products/ColumnSelector';

export type SwatchViewMode = 'grid' | 'list' | 'table';
export type SwatchSizeToken = 'lg' | 'md' | 'sm' | 'xs' | 'xxs';

/** Nome da CSS var que o container seta e o ProductColorSwatches consome. */
export const SWATCH_SIZE_VAR = '--swatch-size';

/**
 * Mapeia (modo, densidade) → token de tamanho.
 * Grid: 3→lg, 4→md, 5→sm, 6→xs, 8→xxs. Lista→xs. Tabela→xxs.
 */
export function resolveSwatchSizeToken(
  viewMode: SwatchViewMode,
  columns?: ColumnCount,
): SwatchSizeToken {
  if (viewMode === 'table') return 'xxs';
  if (viewMode === 'list') return 'xs';
  switch (columns) {
    case 3:
      return 'lg';
    case 4:
      return 'md';
    case 5:
      return 'sm';
    case 6:
      return 'xs';
    case 8:
      return 'xxs';
    default:
      return 'sm';
  }
}

/** Valor CSS (`var(--swatch-size-<token>)`) para o modo/densidade. */
export function swatchSizeCssValue(viewMode: SwatchViewMode, columns?: ColumnCount): string {
  return `var(--swatch-size-${resolveSwatchSizeToken(viewMode, columns)})`;
}

/**
 * Objeto `style` para o container do módulo. Seta `--swatch-size`, que cascateia
 * para todas as bolinhas (grid/lista/tabela) daquele módulo.
 */
export function swatchSizeStyle(
  viewMode: SwatchViewMode,
  columns?: ColumnCount,
): CSSProperties {
  return { [SWATCH_SIZE_VAR]: swatchSizeCssValue(viewMode, columns) } as CSSProperties;
}
