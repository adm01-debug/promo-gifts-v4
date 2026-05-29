import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import AxeBuilder from '@axe-core/playwright';

test.describe("Tooltip Accessibility & Visual Regression", () => {
  test.beforeEach(() => requireAuth());

  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1440, height: 900 }
  ];

  const modes = ['compact', 'standard'];

  for (const viewport of viewports) {
    for (const mode of modes) {
      test(`Tooltip in ${mode} mode on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoAndSettle(page, "/produtos");

        // Toggle tooltip mode via header
        const themeButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
        if (await themeButton.isVisible()) {
            // Logic to ensure we are in the right mode
            // We'll click it once and check toast if needed, but for E2E we can also 
            // just set localStorage directly to be deterministic
            await page.evaluate((m) => {
                localStorage.setItem('gifts-store-tooltip-style', m);
                window.location.reload();
            }, mode);
            await gotoAndSettle(page, "/produtos");
        }

        // Find a tooltip trigger
        const trigger = page.locator('[data-state="closed"]').first();
        await expect(trigger).toBeVisible();
        
        // A11y: Trigger should be focusable if it's a button
        const tagName = await trigger.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'button' || await trigger.getAttribute('tabindex') === '0') {
            await trigger.focus();
            await expect(page.locator('[role="tooltip"]')).toBeVisible();
        }

        // Hover test
        await trigger.hover();
        const tooltip = page.locator('[role="tooltip"]');
        await expect(tooltip).toBeVisible();

        // Accessibility Checks
        const ariaLabel = await trigger.getAttribute('aria-label');
        const ariaDescribedBy = await trigger.getAttribute('aria-describedby');
        expect(ariaDescribedBy || ariaLabel).toBeTruthy();

        // Visual Snapshot
        await expect(tooltip).toHaveScreenshot(`tooltip-${mode}-${viewport.name}.png`);
      });
    }
  }
});
