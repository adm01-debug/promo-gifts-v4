import { test, expect } from '@playwright/test';

test.describe('Floating Buttons Overlap Test', () => {
  test('QuickQuoteFAB and ScrollToTopButton should not overlap at any screen size', async ({ page }) => {
    // Navigate to a page where both buttons are likely to be present (e.g., Catalog)
    await page.goto('/catalog');
    
    // Viewports to test: mobile, tablet, desktop
    const viewports = [
      { width: 375, height: 667 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1440, height: 900 } // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Scroll down to trigger ScrollToTopButton visibility
      await page.evaluate(() => window.scrollTo(0, 1000));
      
      // Wait for buttons to be visible
      // ScrollToTopButton is test-id="scroll-to-top" in ScrollProgress.tsx
      // and used as className="fixed bottom-6 right-6 z-50" in CatalogContent.tsx
      const scrollToTop = page.locator('[data-testid="scroll-to-top"], button[aria-label="Voltar ao topo"], button[aria-label="Voltar ao topo da página"]').first();
      const quickActionFAB = page.locator('button[aria-label="Ações rápidas"], button[aria-label="Fechar menu"]');

      // Check visibility of QuickActionFAB (always visible on most pages unless hidden)
      // ScrollToTopButton should be visible after scroll
      await expect(scrollToTop).toBeVisible();
      await expect(quickActionFAB).toBeVisible();

      const box1 = await scrollToTop.boundingBox();
      const box2 = await quickActionFAB.boundingBox();

      if (box1 && box2) {
        // Verify no overlap
        // Overlap if (x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2)
        const overlap = (
          box1.x < box2.x + box2.width &&
          box1.x + box1.width > box2.x &&
          box1.y < box2.y + box2.height &&
          box1.y + box1.height > box2.y
        );

        expect(overlap, `Buttons overlap at ${viewport.width}x${viewport.height}`).toBe(false);
        
        // Also verify distance (QuickActionFAB should be above ScrollToTopButton)
        expect(box2.y + box2.height, `QuickActionFAB should be above ScrollToTopButton at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(box1.y - 10);
      }
    }
  });
});
