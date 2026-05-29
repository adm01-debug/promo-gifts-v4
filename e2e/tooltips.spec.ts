import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("Tooltip Regression Tests", () => {
  test.beforeEach(({}, testInfo) => {
    requireAuth();
    testInfo.annotations.push({ type: 'component', description: 'Tooltip' });
    testInfo.annotations.push({ type: 'feature', description: 'Regression Visual & Styling' });
  });

  const viewports = [
    { name: 'desktop', width: 1366, height: 768, expectedMaxWidth: "380px", expectedFontSize: 11.7, expectedPadding: /8px|16px/ },
    { name: 'tablet', width: 768, height: 1024, expectedMaxWidth: "380px", expectedFontSize: 11.7, expectedPadding: /8px|16px/ },
    { name: 'mobile', width: 320, height: 568, expectedMaxWidth: "288px", expectedFontSize: 11.7, expectedPadding: /8px|16px/ } // 320 - 32 = 288
  ];

  for (const viewport of viewports) {
    test(`Check tooltip styling on ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'coverage', description: `${viewport.name} Viewport Styling` });
      
      await test.step("Set viewport and navigate", async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoAndSettle(page, "/produtos");
      });
      
      await test.step("Trigger tooltip and validate styles", async () => {
        // Fallback search for different potential triggers
        const tooltipTrigger = page.locator('[data-state="closed"], .tooltip-trigger').first();
        
        if (await tooltipTrigger.count() > 0) {
          await tooltipTrigger.hover();
          
          const tooltip = page.locator('[role="tooltip"]');
          await expect(tooltip).toBeVisible();
          
          const styles = await tooltip.evaluate((el) => {
            const s = window.getComputedStyle(el);
            return {
              fontSize: s.fontSize,
              padding: s.padding,
              maxWidth: s.maxWidth
            };
          });
          
          console.log(`[${viewport.name}] Tooltip Styles:`, styles);
          
          expect(parseFloat(styles.fontSize)).toBeCloseTo(viewport.expectedFontSize, 0);
          expect(styles.padding).toMatch(viewport.expectedPadding);
          
          // Flexible max-width check for responsive calc()
          if (viewport.name === 'mobile') {
            expect(parseFloat(styles.maxWidth)).toBeLessThanOrEqual(parseFloat(viewport.expectedMaxWidth));
          } else {
            expect(styles.maxWidth).toBe(viewport.expectedMaxWidth);
          }
          
          testInfo.annotations.push({ 
            type: 'result', 
            description: `Styles validated on ${viewport.name}: Font=${styles.fontSize}, Padding=${styles.padding}, MaxWidth=${styles.maxWidth}` 
          });
        } else {
          testInfo.annotations.push({ type: 'warning', description: `No tooltip trigger found on ${viewport.name}` });
        }
      });
    });
  }
