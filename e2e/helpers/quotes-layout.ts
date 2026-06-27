/**
 * Espelho E2E do SSOT em `src/lib/quotes/quotesLayout.ts`.
 *
 * Importar o módulo de produção a partir de Playwright traria toda a árvore
 * React (Vite-only). Em vez disso, este arquivo re-exporta as constantes
 * numéricas e tem um guard runtime: se valor divergir do arquivo de produção
 * (lido como string), o spec falha cedo com mensagem clara.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const QUOTES_ROW_H = 80;
export const QUOTES_MAX_VISIBLE_ROWS = 12;
export const QUOTES_MIN_VISIBLE_ROWS = 5;
export const QUOTES_CHROME_BY_BREAKPOINT = {
  mobile: 420,
  tablet: 360,
  desktop: 320,
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

export function containerMaxHeight(vw: number, vh: number): number {
  const cap = QUOTES_MAX_VISIBLE_ROWS * QUOTES_ROW_H;
  return Math.max(QUOTES_MIN_VISIBLE_ROWS * QUOTES_ROW_H, Math.min(cap, vh - chromeHeight(vw)));
}

/** Falha se este mirror divergir do SSOT (compara texto cru do arquivo .ts). */
export function assertMirrorInSyncWithSSOT(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const ssotPath = resolve(here, "../../src/lib/quotes/quotesLayout.ts");
  const src = readFileSync(ssotPath, "utf8");
  const checks: Array<[string, RegExp]> = [
    ["QUOTES_ROW_H", new RegExp(`QUOTES_ROW_H\\s*=\\s*${QUOTES_ROW_H}\\b`)],
    ["QUOTES_MAX_VISIBLE_ROWS", new RegExp(`QUOTES_MAX_VISIBLE_ROWS\\s*=\\s*${QUOTES_MAX_VISIBLE_ROWS}\\b`)],
    ["QUOTES_MIN_VISIBLE_ROWS", new RegExp(`QUOTES_MIN_VISIBLE_ROWS\\s*=\\s*${QUOTES_MIN_VISIBLE_ROWS}\\b`)],
    ["mobile", new RegExp(`mobile:\\s*${QUOTES_CHROME_BY_BREAKPOINT.mobile}\\b`)],
    ["tablet", new RegExp(`tablet:\\s*${QUOTES_CHROME_BY_BREAKPOINT.tablet}\\b`)],
    ["desktop", new RegExp(`desktop:\\s*${QUOTES_CHROME_BY_BREAKPOINT.desktop}\\b`)],
  ];
  for (const [name, re] of checks) {
    if (!re.test(src)) {
      throw new Error(
        `[quotes-layout mirror] divergente do SSOT em "${name}". ` +
          `Atualize e2e/helpers/quotes-layout.ts para refletir src/lib/quotes/quotesLayout.ts.`,
      );
    }
  }
}
