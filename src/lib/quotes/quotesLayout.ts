/**
 * SSOT do layout responsivo da lista de orçamentos.
 *
 * Esses valores são consumidos por:
 *   - `QuotesConfigurableList` (vars CSS `--quotes-row-h` e `--quotes-chrome-h`)
 *   - specs E2E (`e2e/helpers/quotes-layout.ts` reflete os mesmos números)
 *
 * `chromeHeight(viewportWidth)` retorna o espaço (px) reservado pelo header
 * do app + título da página + barra de filtros + rodapé. O container de
 * rolagem ocupa `min(100dvh - chrome, 12 linhas)`.
 *
 * Se mudar aqui, o spec responsivo importa o mesmo módulo — não há divergência.
 */
export const QUOTES_ROW_H = 80;
export const QUOTES_MAX_VISIBLE_ROWS = 12;
export const QUOTES_MIN_VISIBLE_ROWS = 5;

/** Reserva real do "chrome" (não-lista) por breakpoint. */
export const QUOTES_CHROME_BY_BREAKPOINT = {
  mobile: 420, // <640px  — top bar + filtros empilhados + rodapé
  tablet: 360, // ≥640px  — top bar + filtros lado a lado
  desktop: 320, // ≥1024px — top bar compacta
} as const;

export type QuotesBreakpoint = keyof typeof QUOTES_CHROME_BY_BREAKPOINT;

export function breakpointForWidth(width: number): QuotesBreakpoint {
  if (width >= 1024) return "desktop";
  if (width >= 640) return "tablet";
  return "mobile";
}

export function chromeHeight(width: number): number {
  return QUOTES_CHROME_BY_BREAKPOINT[breakpointForWidth(width)];
}

/** Altura efetiva do container para um viewport (h em px). */
export function containerMaxHeight(viewportWidth: number, viewportHeight: number): number {
  const cap = QUOTES_MAX_VISIBLE_ROWS * QUOTES_ROW_H;
  const fromViewport = viewportHeight - chromeHeight(viewportWidth);
  return Math.max(QUOTES_MIN_VISIBLE_ROWS * QUOTES_ROW_H, Math.min(cap, fromViewport));
}
