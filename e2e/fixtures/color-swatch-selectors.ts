/**
 * SSOT de seletores E2E para a feature "seleção de cor + estoque + imagem".
 * Único ponto de verdade — qualquer mudança de testid em src/components/products/*
 * DEVE ser refletida aqui e os specs DEVEM importar exclusivamente daqui.
 *
 * Usado por: e2e/color-swatch-sweep.spec.ts, e2e/color-swatch-selection.spec.ts
 */

/** Atributos `data-*` aplicados em componentes de produto/cor. */
export const ATTR = {
  /** Wrapper de produto em qualquer view (Card, ListItem, TableView). */
  productId: 'data-product-id',
  /** Nome da cor da bolinha (case-preservado, igual ao backend). */
  colorName: 'data-color-name',
  /** Estado de estoque do swatch — 'in-stock' | 'out' | 'upcoming' | undefined. */
  stockState: 'data-stock-state',
  /** Quantidade numérica de estoque exibida (segue cor selecionada quando houver). */
  stockQty: 'data-stock-qty',
} as const;

/** Testids estáveis para asserts E2E. */
export const TID = {
  // Container raiz das bolinhas (role="radiogroup")
  colorsContainer: 'product-colors-container',
  // Botão "Todos" — limpa seleção
  colorsClear: 'color-swatches-clear',
  // Chip "+N" overflow no modo legado
  colorsOverflow: 'color-swatches-overflow',
  // Tooltip de cor (Radix)
  colorTooltip: 'color-tooltip-content',
  // Badge "reposição prevista"
  swatchUpcomingDot: 'swatch-upcoming-dot',
  // Bolinha individual: `${TID.swatch}${slug(colorName)}`
  swatch: 'color-swatch-',
  // Valor de estoque exibido (Card, ListItem md+, TableView)
  productStockValue: 'product-stock-value',
  // Imagem principal do produto (Card, ListItem, TableView)
  productImage: 'product-image',
  // Toolbar/popover de troca de view
  layoutPopoverTrigger: 'layout-popover-trigger',
  viewMode: (mode: 'grid' | 'list' | 'table') => `view-mode-${mode}`,
} as const;

/** Constrói o slug usado no testid de cada bolinha. */
export const swatchTestId = (colorName: string): string =>
  `${TID.swatch}${colorName.toLowerCase().replace(/\s+/g, '-')}`;
