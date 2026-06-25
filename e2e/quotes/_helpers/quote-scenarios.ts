/**
 * Cenários compartilhados de quote_number para specs E2E.
 *
 * Centraliza:
 *  - matriz de breakpoints (incluindo intermediários 768/1024)
 *  - regex de validação do formato `NNNNN/YY`
 *  - frase legada que NÃO pode aparecer em nenhum modo
 *  - helpers para navegar até cada cenário (Novo / Rascunho / Enviada)
 *
 * Reduz duplicação entre `quote-number-subtitle.spec.ts`,
 * `quote-subtitle-differentiation.spec.ts` e `quote-pdf-quote-number.spec.ts`.
 */
import type { Page } from '@playwright/test';
import { gotoAndSettle } from '../../helpers/nav';

export const FORBIDDEN_PHRASE = 'Crie um orçamento com produtos e personalizações';

/** Formato canônico aceito na UI/PDF. */
export const QUOTE_NUMBER_REGEX = /\b\d{3,6}\/\d{2}\b/;

/**
 * Matriz oficial de breakpoints — usar em todos os specs visuais de
 * quote_number para manter cobertura consistente.
 * Inclui pontos intermediários 768 (tablet portrait) e 1024 (tablet landscape)
 * para detectar quebras de layout no topo do documento.
 */
export const QUOTE_BREAKPOINTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

export type QuoteScenario = 'novo' | 'rascunho' | 'enviada';

/**
 * Navega até o cenário pedido. Para `rascunho`/`enviada` busca o primeiro
 * orçamento da listagem do status correspondente. Retorna `false` quando
 * não há dado mínimo (caller deve `test.skip`).
 */
export async function gotoQuoteScenario(page: Page, scenario: QuoteScenario): Promise<boolean> {
  if (scenario === 'novo') {
    await gotoAndSettle(page, '/orcamentos/novo');
    return true;
  }

  await gotoAndSettle(page, '/orcamentos');
  // Heurística estável: pega o primeiro card/linha cujo status case com o cenário.
  const statusBadge = scenario === 'rascunho' ? /Rascunho/i : /Enviad[ao]/i;
  const row = page
    .locator('[data-testid^="quote-row-"], a[href*="/orcamentos/"][href$="/editar"]')
    .filter({ hasText: statusBadge })
    .first();
  if ((await row.count()) === 0) return false;
  await row.click();
  await page.waitForURL(/\/orcamentos\/[^/]+\/editar/, { timeout: 10_000 }).catch(() => undefined);
  return true;
}
