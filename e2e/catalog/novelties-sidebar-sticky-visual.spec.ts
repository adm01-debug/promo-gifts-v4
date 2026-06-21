/**
 * E2E — Sticky de header/widget em /novidades sob scroll interno.
 *
 * O scroll acontece no container interno do grid. Em 1366×768 e 1920×1080:
 *  - Header permanece em viewport (não some) após o scroll interno.
 *  - O top do header não muda entre antes/depois (sticky real, sem shift).
 *  - Em ≥ xl (≥1280px), o widget lateral `ExpiringNoveltiesWidget` permanece.
 *  - Janela NÃO rola (window.scrollY ≈ 0).
 *  - Screenshots de evidência salvas no relatório.
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

    test(`header + widget permanecem sticky após scroll interno (${vp.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/novidades');

      const header = page.getByTestId('page-title-novidades');
      await expect(header).toBeVisible();
      await expect(header).toBeInViewport();

      const scroller = page.getByTestId('novelty-grid-scroll');
      await expect(scroller).toBeVisible({ timeout: 15_000 });

      const items = await page.locator('div[role="listitem"]').count();
      if (items === 0) {
        test.skip(true, 'Sem novidades no dataset — sticky não aplicável.');
        return;
      }

      const headerTopBefore = await header.evaluate((el) => el.getBoundingClientRect().top);

      // Rola o container interno ~2 alturas visíveis.
      await scroller.evaluate((el) => el.scrollTo({ top: el.clientHeight * 2 }));
      await page.waitForTimeout(400);

      // Janela NÃO rolou.
      const windowY = await page.evaluate(() => window.scrollY);
      expect(windowY).toBeLessThan(5);

      // Header continua em viewport, sem shift (sticky real).
      await expect(header).toBeInViewport();
      const headerTopAfter = await header.evaluate((el) => el.getBoundingClientRect().top);
      expect(Math.abs(headerTopAfter - headerTopBefore)).toBeLessThanOrEqual(4);

      // Widget lateral em ≥ xl.
      if (vp.width >= 1280) {
        const widget = page
          .locator('[class*="xl:sticky"]')
          .filter({ has: page.locator('text=/Recentes|Por Fornecedor/i') })
          .first();
        if ((await widget.count()) > 0) {
          await expect(widget).toBeInViewport();
        }
      }

      await page.screenshot({
        path: `playwright-report/novidades-sticky-${vp.name}-scrolled.png`,
        fullPage: false,
      });
    });
  });
}
