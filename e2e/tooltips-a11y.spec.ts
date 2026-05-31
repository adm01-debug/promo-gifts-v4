import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import AxeBuilder from '@axe-core/playwright';

test.describe("Tooltip Accessibility & Visual Regression", () => {
  test.beforeEach(({}, testInfo) => {
    requireAuth();
    testInfo.annotations.push({ type: 'component', description: 'Tooltip' });
    testInfo.annotations.push({ type: 'component', description: 'TruncatedTooltip' });
    testInfo.annotations.push({ type: 'component', description: 'TooltipContent' });
    testInfo.annotations.push({ type: 'component', description: 'TooltipTrigger' });
    testInfo.annotations.push({ type: 'feature', description: 'Accessibility (axe-core)' });
    testInfo.annotations.push({ type: 'feature', description: 'Visual Regression (Screenshots)' });
    testInfo.annotations.push({ type: 'feature', description: 'Theme Support (Compact vs Standard)' });
  });

  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1440, height: 900 }
  ];

  const modes = ['compact', 'standard'];

  for (const viewport of viewports) {
    for (const mode of modes) {
      test(`Tooltip in ${mode} mode on ${viewport.name}`, async ({ page }, testInfo) => {
        testInfo.annotations.push({ type: 'coverage', description: `Mode: ${mode}, Viewport: ${viewport.name}` });
        
        await test.step("Set viewport and apply theme mode", async () => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await gotoAndSettle(page, "/produtos");

            // Toggle tooltip mode via header
            const themeButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
            if (await themeButton.isVisible()) {
                await page.evaluate((m) => {
                    localStorage.setItem('gifts-store-tooltip-style', m);
                    window.location.reload();
                }, mode);
                await gotoAndSettle(page, "/produtos");
            }
        });

        const trigger = page.locator('[data-state="closed"]').first();
        await expect(trigger).toBeVisible();
        
        await test.step("Accessibility: Keyboard Navigation", async () => {
            const tagName = await trigger.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'button' || await trigger.getAttribute('tabindex') === '0') {
                await trigger.focus();
                await expect(page.locator('[role="tooltip"]')).toBeVisible();
                testInfo.annotations.push({ type: 'a11y-check', description: 'Keyboard focus triggers tooltip' });
            }
        });

        await test.step("Accessibility: Mouse Hover", async () => {
            await trigger.hover();
            const tooltip = page.locator('[role="tooltip"]');
            
            // Validação de delay de 1000ms
            await expect(tooltip).not.toBeVisible();
            await page.waitForTimeout(800);
            await expect(tooltip).not.toBeVisible();
            
            await expect(tooltip).toBeVisible();
            testInfo.annotations.push({ type: 'a11y-check', description: 'Mouse hover triggers tooltip' });
        });

        await test.step("Axe-core Audit", async () => {
            const ariaLabel = await trigger.getAttribute('aria-label');
            const ariaDescribedBy = await trigger.getAttribute('aria-describedby');
            expect(ariaDescribedBy || ariaLabel).toBeTruthy();

            const accessibilityScanResults = await new AxeBuilder({ page })
              .include('[role="tooltip"]')
              .analyze();
            
            expect(accessibilityScanResults.violations).toEqual([]);
            testInfo.annotations.push({ type: 'a11y-check', description: 'Axe-core validation passed for tooltip content' });

            const triggerA11y = await new AxeBuilder({ page })
              .include('[data-state="open"]')
              .analyze();
            expect(triggerA11y.violations).toEqual([]);
        });

        await test.step("Visual Snapshot", async () => {
            const tooltip = page.locator('[role="tooltip"]');
            await expect(tooltip).toHaveScreenshot(`tooltip-${mode}-${viewport.name}.png`);
            testInfo.annotations.push({ type: 'visual-check', description: `Snapshot taken: tooltip-${mode}-${viewport.name}.png` });
        });
      });
    }
  }
});
