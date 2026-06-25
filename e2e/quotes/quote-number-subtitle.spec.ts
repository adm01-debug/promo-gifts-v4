/**
 * E2E — Subtítulo de quote_number no header do Novo Orçamento.
 *
 * Garante que o `data-testid="quote-number-display"` substitui a antiga
 * frase "Crie um orçamento com produtos e personalizações" em TODOS os
 * breakpoints. Em modo "novo", exibe ou a prévia (`Próx. ~N/YY`) ou o
 * fallback ("Nº a ser gerado ao salvar") — nunca a frase original.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos/novo';
const FORBIDDEN_PHRASE = 'Crie um orçamento com produtos e personalizações';

test.describe('Novo Orçamento · quote_number subtítulo', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Visual regression roda só no Chromium autenticado.',
  );
  test.beforeEach(() => requireAuth());

  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'wide', width: 1920, height: 1080 },
  ] as const) {
    test(`[${vp.name}] exibe quote-number-display e não exibe a frase legada`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);

      const subtitle = page.getByTestId('quote-number-display');
      await expect(subtitle).toBeVisible();

      // Conteúdo aceitável em modo "novo": prévia OU fallback.
      const text = (await subtitle.textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
      expect(text).toMatch(/(Próx\.|Nº a ser gerado ao salvar)/);

      // Frase legada NUNCA pode aparecer em nenhum breakpoint.
      await expect(page.locator('body')).not.toContainText(FORBIDDEN_PHRASE);

      // Snapshot visual do bloco do título para detectar regressões.
      const header = page.locator('[data-testid="quote-number-display"]').locator('xpath=ancestor::div[1]');
      await expect(header).toHaveScreenshot(`quote-number-subtitle-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
