/**
 * E2E — Regressão visual do grid de StockStatCards em todos os breakpoints.
 *
 * Captura o grid inteiro (5 cards) com animações congeladas para flagrar
 * regressões de alinhamento, gap ou padding após a redução vertical.
 *
 * Atualizar baselines:
 *   npx playwright test e2e/admin/stock-stat-card-visual.spec.ts --update-snapshots
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const VIEWPORTS = [
  { name: 'xs-320', width: 320, height: 700 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1536', width: 1536, height: 864 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

async function settle(page: Page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await expect(page.locator(Sel.stock.statCard).first()).toBeVisible({ timeout: 15_000 });
  // Garante que o contador animado terminou.
  await page.waitForTimeout(700);
}

test.describe('StockStatCard — regressão visual (grid completo)', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('grid de cards', async ({ page }) => {
        await loginAs(page);
        await gotoAndSettle(page, '/estoque');
        await settle(page);
        // Localiza o card "total-de-produtos" e sobe ao grid pai (gridcell → grid).
        const firstCard = page.locator(Sel.stock.statCardBySlug('total-de-produtos'));
        await expect(firstCard).toBeVisible();
        const grid = firstCard.locator('xpath=..');
        await expect(grid).toHaveScreenshot(`stock-stat-card-grid-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });
    });
  }
});
