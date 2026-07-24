import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe('Floating Buttons Visual Stability', () => {
  test.beforeEach(() => requireAuth());

  const viewports = [
    { name: 'Mobile-Small', width: 320, height: 568 },
    { name: 'Mobile-Standard', width: 375, height: 667 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop-Small', width: 1024, height: 768 },
    { name: 'Desktop-Wide', width: 1440, height: 900 }
  ];

  for (const vp of viewports) {
    test(`Visual and interaction validation on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/catalog');
      await waitForRouteIdle(page);

      // Add height to force scroll
      await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "3000px";
        document.body.appendChild(spacer);
      });

      const scrollToTop = page.locator(Sel.app.layout.scrollToTop);
      const quickActionFAB = page.locator('button[aria-label="Ações rápidas"], button[aria-label="Fechar menu"]');

      // 1. Initial state (only FAB visible)
      await expect(quickActionFAB).toBeVisible();
      await expect(scrollToTop).not.toBeVisible();

      // 2. Scroll and take snapshot
      await page.evaluate(() => window.scrollTo(0, 1500));
      await expect(scrollToTop).toBeVisible();
      
      // Wait for layout transitions
      await page.waitForTimeout(500);

      const fabBox = await quickActionFAB.boundingBox();
      const sttBox = await scrollToTop.boundingBox();

      if (fabBox && sttBox) {
        // Validation: Separation
        expect(fabBox.y + fabBox.height).toBeLessThan(sttBox.y);
        
        // Validation: Distance (minimum 20px)
        const distance = sttBox.y - (fabBox.y + fabBox.height);
        expect(distance).toBeGreaterThan(20);
      }

      // 3. Interaction validation: click in proximity
      // Click Quick Action FAB
      await quickActionFAB.click();
      await expect(page.locator('text=Novo Orçamento')).toBeVisible();
      
      // Close it (click backdrop)
      await page.mouse.click(10, 10);
      await expect(page.locator('text=Novo Orçamento')).not.toBeVisible();

      // Click Scroll to Top
      await scrollToTop.click();
      await page.waitForTimeout(500);
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeLessThan(100);

      // 4. Check for layout shifts/reflows during scroll
      await page.evaluate(() => window.scrollTo(0, 500));
      const entries = await page.evaluate(() => {
        return JSON.stringify(performance.getEntriesByType('layout-shift'));
      });
      const shifts = JSON.parse(entries);
      // Cumulative Layout Shift should be low for these elements
      const totalShift = shifts.reduce((sum: number, shift: any) => sum + shift.value, 0);
      expect(totalShift).toBeLessThan(0.1);
    });
  }
});
