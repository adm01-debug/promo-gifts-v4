import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe('Floating Buttons Overlap Test', () => {
  test.beforeEach(() => requireAuth());

  test('QuickQuoteFAB and ScrollToTopButton should not overlap at any screen size', async ({ page }) => {
    // Navigate to Catalog
    await gotoAndSettle(page, '/catalog');
    await waitForRouteIdle(page);
    
    // Viewports to test: mobile, tablet, desktop
    const viewports = [
      { width: 375, height: 667 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1440, height: 900 } // Desktop
    ];

    // Disable smooth scroll for deterministic tests
    await page.addStyleTag({
      content: `html { scroll-behavior: auto !important; }`,
    });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Ensure page has height
      await page.evaluate(() => {
        if (document.body.scrollHeight < window.innerHeight + 2000) {
          const spacer = document.createElement("div");
          spacer.style.height = "2400px";
          spacer.setAttribute("data-e2e-spacer", "");
          document.body.appendChild(spacer);
        }
      });

      // Scroll down to trigger ScrollToTopButton visibility
      await page.evaluate(() => window.scrollTo(0, 1500));
      
      // Wait for buttons to be visible
      const scrollToTop = page.locator(Sel.app.layout.scrollToTop);
      const quickActionFAB = page.locator('button[aria-label="Ações rápidas"], button[aria-label="Fechar menu"]');

      await expect(scrollToTop).toBeVisible({ timeout: 5000 });
      await expect(quickActionFAB).toBeVisible({ timeout: 5000 });

      const box1 = await scrollToTop.boundingBox();
      const box2 = await quickActionFAB.boundingBox();

      if (box1 && box2) {
        // Verify no overlap
        const overlap = (
          box1.x < box2.x + box2.width &&
          box1.x + box1.width > box2.x &&
          box1.y < box2.y + box2.height &&
          box1.y + box1.height > box2.y
        );

        expect(overlap, `Buttons overlap at ${viewport.width}x${viewport.height}`).toBe(false);
        
        // Verify QuickActionFAB is above ScrollToTopButton
        // FAB is at bottom-[110px] (sm:bottom-[130px])
        // ScrollToTop is at bottom-6 (24px)
        expect(box2.y + box2.height, `QuickActionFAB should be above ScrollToTopButton at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(box1.y - 10);
      }
    }
  });
});
