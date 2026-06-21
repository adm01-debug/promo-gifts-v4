/**
 * E2E — Snapshots visuais de /novidades em 1366×768 e 1920×1080.
 *
 * Garante que não há sobreposição/shift entre sidebar fixa, header sticky
 * e o conteúdo enquanto o container interno do grid é rolado. Captura dois
 * snapshots por viewport: estado inicial e após rolar o container ~2 alturas.
 *
 * Para atualizar baseline: `npx playwright test --update-snapshots`
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Novidades — snapshots visuais (${vp.name})`, () => {
    test.beforeEach(() => requireAuth());

    test(`layout estável antes e depois de rolar (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/novidades');

      const scroller = page.getByTestId('novelty-grid-scroll');
      await expect(scroller).toBeVisible({ timeout: 15_000 });

      const items = await page.locator('div[role="listitem"]').count();
      if (items === 0) {
        test.skip(true, 'Sem novidades no dataset — snapshot não aplicável.');
        return;
      }

      // Estabiliza animações para snapshot determinístico.
      await page.addStyleTag({
        content: '*,*::before,*::after{animation:none!important;transition:none!important}',
      });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`novidades-initial-${vp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      // Rola o container ~2 alturas internas e captura de novo.
      await scroller.evaluate((el) => el.scrollTo({ top: el.clientHeight * 2 }));
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`novidades-scrolled-${vp.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}
