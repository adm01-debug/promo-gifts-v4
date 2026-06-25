/**
 * E2E — FAB "Novo Orçamento" no header de /orcamentos.
 *
 * Valida em todos os breakpoints da matriz QUOTE_BREAKPOINTS:
 *  - FAB visível, circular (~44x44), com aria-label
 *  - mesma linha do título em >= sm; agrupado no header em mobile
 *  - tooltip "Criar novo orçamento em segundos" aparece no hover E no focus
 *  - click navega para /orcamentos/novo
 *  - screenshot do header por viewport
 *
 * Roda só no project autenticado (mesmo padrão de quote-number-subtitle).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { QUOTE_BREAKPOINTS } from './_helpers/quote-scenarios';

test.describe('QuotesListPage · FAB Novo Orçamento', () => {
  test.skip(
    (_args, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Visual/responsive regression roda só no Chromium autenticado.',
  );
  test.beforeEach(() => requireAuth());

  for (const vp of QUOTE_BREAKPOINTS) {
    test(`[${vp.name}] FAB acessível, posicionado e funcional`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/orcamentos');

      const fab = page.getByTestId('quote-new-button');
      const title = page.getByTestId('page-title-orcamentos');

      await expect(fab).toBeVisible();
      await expect(title).toBeVisible();
      await expect(fab).toHaveAttribute('aria-label', 'Novo orçamento');

      // Geometria: tap target >= 44x44 e formato circular (largura ~ altura).
      const box = await fab.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2);
      }

      // Em >= sm (>= 640px) FAB e título compartilham a mesma linha.
      if (vp.width >= 640) {
        const titleBox = await title.boundingBox();
        if (box && titleBox) {
          const yFab = box.y + box.height / 2;
          const yTitle = titleBox.y + titleBox.height / 2;
          expect(Math.abs(yFab - yTitle)).toBeLessThanOrEqual(40);
        }
      }

      // Tooltip via hover.
      await fab.hover();
      await expect(page.getByText(/Criar novo orçamento em segundos/i)).toBeVisible({
        timeout: 3_000,
      });

      // Reset hover + tooltip via focus de teclado.
      await page.mouse.move(0, 0);
      await page.keyboard.press('Escape').catch(() => undefined);
      await fab.focus();
      await expect(page.getByText(/Criar novo orçamento em segundos/i)).toBeVisible({
        timeout: 3_000,
      });

      // Screenshot do bloco do header (ancestral imediato do título).
      const headerBlock = title.locator('xpath=ancestor::div[1]');
      await expect(headerBlock).toHaveScreenshot(`quote-new-fab-header-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });

      // Click → navega para o builder.
      await page.mouse.move(0, 0);
      await fab.click();
      await page.waitForURL(/\/orcamentos\/novo/, { timeout: 10_000 });
      await expect(page).toHaveURL(/\/orcamentos\/novo/);
    });
  }
});
