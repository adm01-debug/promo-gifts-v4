/**
 * E2E — Subtítulo de quote_number no header do Novo Orçamento.
 *
 * Garante que `data-testid="quote-number-display"` substitui a antiga
 * frase legada em TODOS os breakpoints (incluindo intermediários 768/1024).
 * Refatorado para usar o helper compartilhado `_helpers/quote-scenarios`.
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import {
  FORBIDDEN_PHRASE,
  QUOTE_BREAKPOINTS,
  gotoQuoteScenario,
} from './_helpers/quote-scenarios';

test.describe('Novo Orçamento · quote_number subtítulo', () => {
  test.skip(
    ({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Visual regression roda só no Chromium autenticado.',
  );
  test.beforeEach(() => requireAuth());

  for (const vp of QUOTE_BREAKPOINTS) {
    test(`[${vp.name}] exibe quote-number-display e não exibe a frase legada`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoQuoteScenario(page, 'novo');

      const subtitle = page.getByTestId('quote-number-display');
      await expect(subtitle).toBeVisible();

      const text = (await subtitle.textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
      // Modo novo: prévia OU fallback amigável.
      expect(text).toMatch(/(Próx\.|Nº a ser gerado ao salvar|Nº indisponível)/);

      // Frase legada NUNCA pode aparecer em nenhum breakpoint.
      await expect(page.locator('body')).not.toContainText(FORBIDDEN_PHRASE);

      // Topo do documento não pode quebrar/transbordar a numeração.
      const overflow = await subtitle.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, sw: el.scrollWidth, oh: el.scrollHeight, ch: r.height };
      });
      expect(overflow.sw).toBeLessThanOrEqual(Math.ceil(overflow.w) + 2);

      const header = page
        .locator('[data-testid="quote-number-display"]')
        .locator('xpath=ancestor::div[1]');
      await expect(header).toHaveScreenshot(`quote-number-subtitle-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
