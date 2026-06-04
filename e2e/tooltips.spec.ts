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
    { name: 'mobile', width: 320, height: 568, expectedMaxWidth: "288px", expectedFontSize: 11.7, expectedPadding: /8px|16px/ }
  ];

  for (const viewport of viewports) {
    test(`Check tooltip styling and truncation on ${viewport.name}`, async ({ page }, testInfo) => {
      testInfo.annotations.push({ type: 'coverage', description: `${viewport.name} Viewport Styling & Truncation` });
      
      await test.step("Set viewport and navigate", async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await gotoAndSettle(page, "/produtos");
      });
      
      await test.step("Trigger tooltip and validate styles", async () => {
        const tooltipTrigger = page.locator('[data-state="closed"], .tooltip-trigger').first();
        
        if (await tooltipTrigger.count() > 0) {
          const startTime = Date.now();
          await tooltipTrigger.hover();
          
          const tooltip = page.locator('[role="tooltip"]');
          
          // Timing assertions: never appear before 1000ms
          await page.waitForTimeout(900);
          await expect(tooltip).not.toBeVisible();
          
          // Should appear at or after 1000ms
          await expect(tooltip).toBeVisible({ timeout: 2000 });
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          expect(duration).toBeGreaterThanOrEqual(1000);
          testInfo.annotations.push({ type: 'performance', description: `Tooltip appeared in ${duration}ms` });
          
          const styles = await tooltip.evaluate((el) => {
            const s = window.getComputedStyle(el);
            return {
              fontSize: s.fontSize,
              padding: s.padding,
              maxWidth: s.maxWidth,
              display: s.display,
              webkitLineClamp: s.webkitLineClamp,
              overflow: s.overflow
            };
          });
          
          // Registrar valores finais no relatório para comparação entre branches
          testInfo.annotations.push({ type: 'style-audit', description: `Final Font: ${styles.fontSize}` });
          testInfo.annotations.push({ type: 'style-audit', description: `Final Padding: ${styles.padding}` });
          testInfo.annotations.push({ type: 'style-audit', description: `Final MaxWidth: ${styles.maxWidth}` });
          
          expect(parseFloat(styles.fontSize)).toBeCloseTo(viewport.expectedFontSize, 0);
          expect(styles.padding).toMatch(viewport.expectedPadding);
          
          if (viewport.name === 'mobile') {
            expect(parseFloat(styles.maxWidth)).toBeLessThanOrEqual(parseFloat(viewport.expectedMaxWidth));
          } else {
            expect(styles.maxWidth).toBe(viewport.expectedMaxWidth);
          }

          // Verificação de Truncamento (line-clamp)
          await test.step("Verify truncation rules", async () => {
            expect(styles.overflow).toBe('hidden');
            // line-clamp-10 set in tooltip.tsx
            expect(styles.webkitLineClamp).toBe('10');
            
            const boundingBox = await tooltip.boundingBox();
            if (boundingBox) {
              expect(boundingBox.width).toBeLessThanOrEqual(viewport.width);
              testInfo.annotations.push({ type: 'viewport-check', description: `Tooltip width (${boundingBox.width}px) is within viewport (${viewport.width}px)` });
            }
          });
          
          testInfo.annotations.push({ 
            type: 'result', 
            description: `Full validation passed on ${viewport.name}` 
          });
        }
      });
    });
  }
});
