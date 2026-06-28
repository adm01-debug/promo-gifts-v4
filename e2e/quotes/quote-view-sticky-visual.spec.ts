/**
 * Visual regression: sidebar fixa antes e depois do scroll de página.
 * Mascara conteúdo dinâmico (números/datas) para focar no LAYOUT do sticky.
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

test.describe('@visual sidebar sticky — antes/depois do scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
  });

  test('sidebar antes do scroll', async ({ page }) => {
    const aside = page.locator('aside').first();
    await expect(aside).toHaveScreenshot('sidebar-before-scroll.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('sidebar depois do scroll até "Versões do Orçamento"', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    const aside = page.locator('aside').first();
    await expect(aside).toHaveScreenshot('sidebar-after-scroll.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
