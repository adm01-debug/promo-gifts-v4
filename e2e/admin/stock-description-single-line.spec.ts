/**
 * E2E — Descrição do StockDashboardPage permanece em uma única linha
 * em mobile (390), tablet (768) e desktop (1280), espelhando Novidades.
 */
import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

test.describe('Estoque — descrição em linha única', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  for (const vp of VIEWPORTS) {
    test(`descrição não quebra em ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/estoque');

      const desc = page.getByTestId('page-description-estoque');
      await expect(desc).toBeVisible();

      const metrics = await desc.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        const lineHeight = parseFloat(cs.lineHeight) || el.clientHeight;
        return {
          clientHeight: el.clientHeight,
          lineHeight,
          whiteSpace: cs.whiteSpace,
          overflow: cs.overflow,
          textOverflow: cs.textOverflow,
        };
      });

      // single line: altura ≈ uma line-height
      expect(metrics.clientHeight).toBeLessThanOrEqual(metrics.lineHeight * 1.4);
      expect(metrics.whiteSpace).toBe('nowrap');
      expect(metrics.textOverflow).toBe('ellipsis');
      expect(metrics.overflow).toMatch(/hidden/);
    });
  }
});
