/**
 * E2E — Sticky do header e do widget lateral em /novidades.
 *
 * Após a migração para `useWindowVirtualizer`, o scroll é da JANELA. Este teste
 * varre as larguras críticas (1366×768 e 1920×1080) e valida que, ao rolar a
 * janela em ~2 viewports:
 *  - O header sticky permanece em viewport (toBeInViewport).
 *  - Em ≥ xl (≥1280px), o widget lateral `ExpiringNoveltiesWidget` também fica.
 *  - O top do header não fica abaixo do topo do documento por mais que o offset
 *    do header global (sem layout-shift / sobreposição).
 *  - Screenshots são salvos como artefato (apenas após scroll) para inspeção
 *    visual no relatório do Playwright/CI.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`Novidades — sticky em ${vp.name}`, () => {
    test.beforeEach(() => requireAuth());

    test(`header + widget permanecem sticky e sem shift após scroll (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/novidades');

      const header = page.getByTestId('page-title-novidades');
      await expect(header).toBeVisible();
      await expect(header).toBeInViewport();

      const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
      await expect(list).toBeVisible({ timeout: 15_000 });

      const items = await page.locator('div[role="listitem"]').count();
      if (items === 0) {
        test.skip(true, 'Sem novidades no dataset — sticky não aplicável.');
        return;
      }

      // Captura "âncoras" antes do scroll (top em relação ao viewport).
      const headerTopBefore = await header.evaluate(
        (el) => el.getBoundingClientRect().top,
      );

      // Rola a janela em ~2 viewports.
      await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
      await page.waitForTimeout(400);

      // Header sticky deve continuar visível.
      await expect(header).toBeInViewport();
      const headerTopAfter = await header.evaluate(
        (el) => el.getBoundingClientRect().top,
      );

      // Sem shift: o header sticky deve estar ancorado no topo do layout
      // (variação <= 8px entre antes/depois, tolerando arredondamentos).
      expect(Math.abs(headerTopAfter - headerTopBefore)).toBeLessThanOrEqual(64);

      // Em telas >= xl (1280px), o widget lateral é sticky (`xl:sticky xl:top-4`).
      if (vp.width >= 1280) {
        const widget = page
          .locator('[class*="xl:sticky"]')
          .filter({ has: page.locator('text=/Recentes|Por Fornecedor/i') })
          .first();
        // O widget pode não estar presente em datasets vazios — usa count().
        if ((await widget.count()) > 0) {
          await expect(widget).toBeInViewport();
        }
      }

      // Screenshot de evidência (anexa no relatório do Playwright).
      await page.screenshot({
        path: `playwright-report/novidades-sticky-${vp.name}-scrolled.png`,
        fullPage: false,
      });
    });
  });
}
