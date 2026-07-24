/**
 * SSOT — Seletores e atributos para testes E2E de bolinhas de cor.
 *
 * Sempre que um data-testid ou data-attr ligado a variações de cor mudar,
 * altere AQUI. Specs nunca devem hardcodar strings desses seletores.
 */

export const ATTR = {
  productId: 'data-product-id',
  colorName: 'data-color-name',
  stockState: 'data-stock-state',
  stockQty: 'data-stock-qty',
} as const;

export const TID = {
  productCard: 'product-card',
  productImage: 'product-image',
  productStockValue: 'product-stock-value',
  colorsContainer: 'product-color-swatches',
  colorsClear: 'color-swatches-clear',
  colorsOverflow: 'color-swatches-overflow',
  colorTooltip: 'color-swatch-tooltip',
  swatchUpcomingDot: 'color-swatch-upcoming-dot',
  /** Seletor CSS para qualquer swatch (prefix-match). */
  swatch: 'color-swatch-',
  layoutPopoverTrigger: 'layout-popover-trigger',
  viewMode: (mode: 'grid' | 'list' | 'table') => `view-mode-${mode}`,
} as const;

/** Helpers de seletor CSS pré-formatados. */
export const SEL = {
  byTid: (tid: string) => `[data-testid="${tid}"]`,
  byTidPrefix: (prefix: string) => `[data-testid^="${prefix}"]`,
  byAttr: (attr: string, value?: string) =>
    value === undefined ? `[${attr}]` : `[${attr}="${value}"]`,
} as const;
