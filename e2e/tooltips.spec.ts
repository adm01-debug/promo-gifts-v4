import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("Tooltip Regression Tests", () => {
  test.beforeEach(() => requireAuth());

  test("Check tooltip styling (font size, padding, max-width)", async ({ page }) => {
    // Navigate to a page with tooltips - using Sidebar items as they are reliable
    await gotoAndSettle(page, "/produtos");
    
    // Collapse sidebar to ensure tooltips are triggered on hover
    // Finding the collapse button in Sidebar - usually it's there
    // Alternatively, just hover a sidebar icon if it's already collapsed (mobile/collapsed desktop)
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Trigger a tooltip by hovering a sidebar item (collapsed mode usually triggers tooltips)
    // First, find the sidebar trigger to collapse it if needed, 
    // but in many layouts tooltips exist on various icons.
    
    // Let's try to find any TooltipTrigger
    const tooltipTrigger = page.locator('[data-state="closed"]').first();
    if (await tooltipTrigger.count() > 0) {
      await tooltipTrigger.hover();
      
      // Tooltip should appear
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      // Check CSS properties
      const fontSize = await tooltip.evaluate((el) => window.getComputedStyle(el).fontSize);
      const padding = await tooltip.evaluate((el) => window.getComputedStyle(el).padding);
      const maxWidth = await tooltip.evaluate((el) => window.getComputedStyle(el).maxWidth);
      
      console.log(`Tooltip Font Size: ${fontSize}`);
      console.log(`Tooltip Padding: ${padding}`);
      console.log(`Tooltip Max Width: ${maxWidth}`);
      
      // Font size should be ~9px (some browsers might round)
      expect(parseFloat(fontSize)).toBeCloseTo(9, 0);
      
      // Padding should be ~6px 12px (px-3 py-1.5 -> 0.75rem 0.375rem -> 12px 6px)
      // Note: getComputedStyle(el).padding might return "6px 12px" or similar
      expect(padding).toMatch(/6px|12px/);
      
      // Max width should be 240px on desktop
      expect(maxWidth).toBe("240px");
    }
  });

  test("Tooltip responsiveness on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await gotoAndSettle(page, "/produtos");
    
    // Trigger tooltip
    const tooltipTrigger = page.locator('button[aria-haspopup="dialog"], [data-state="closed"]').first();
    if (await tooltipTrigger.count() > 0) {
      await tooltipTrigger.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      const maxWidth = await tooltip.evaluate((el) => window.getComputedStyle(el).maxWidth);
      // On 320px, max-width should be min(calc(100vw - 2rem), 240px) -> min(320-32, 240) -> 240 or 288?
      // 320 - 32 = 288. Oh, 240px is smaller.
      // Wait, 100vw - 2rem = 320 - 32 = 288. 240 < 288. So it should still be 240px.
      // Unless the viewport is even smaller.
      expect(parseFloat(maxWidth)).toBeLessThanOrEqual(240);
    }
  });
});
