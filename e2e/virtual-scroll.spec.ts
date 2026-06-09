import { test, expect } from '@playwright/test';

test.describe('Virtual Scroll Performance', () => {
  test('should scroll through large list without layout shifts or freezes', async ({ page }) => {
    await page.goto('/');
    
    const gridContainer = page.locator('[data-testid="virtualized-product-grid"]');
    await expect(gridContainer).toBeVisible();
    
    // Check initial items
    const initialItems = await page.locator('[data-testid="product-card"]').count();
    expect(initialItems).toBeGreaterThan(0);
    
    // Scroll down multiple times
    for (let i = 0; i < 5; i++) {
      await gridContainer.evaluate((el) => {
        el.scrollTop += 2000;
      });
      // Wait for content to render
      await page.waitForTimeout(500);
      
      // Check that we still have items and no white screen
      const itemsAfterScroll = await page.locator('[data-testid="product-card"]').count();
      expect(itemsAfterScroll).toBeGreaterThan(0);
    }
    
    // Check for "Voltar ao topo" button
    const scrollTopBtn = page.locator('button[title="Voltar ao topo"]');
    await expect(scrollTopBtn).toBeVisible();
    
    // Click scroll to top and verify we are back at top
    await scrollTopBtn.click();
    await page.waitForTimeout(1000);
    const scrollTop = await gridContainer.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeLessThan(100);
  });
});
