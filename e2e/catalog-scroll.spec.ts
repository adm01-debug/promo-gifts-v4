import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Infinite Scroll & UI Regression", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("should load more products on scroll and not show pagination", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Check pagination is NOT present
    const pagination = page.locator('[data-testid*="pagination"]');
    for (const el of await pagination.all()) {
      await expect(el).not.toBeVisible();
    }

    // Check black bar is NOT present
    const blackBar = page.locator('.bg-black, .bg-zinc-950').filter({ hasText: /página|anterior|próximo/i });
    await expect(blackBar).not.toBeVisible();

    // Count initial products
    const initialCards = await page.locator('[data-testid="product-card"]').count();
    
    // Scroll to trigger load more
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Verify skeletons appear during load
    const skeletons = page.locator('[data-testid="product-card-skeleton"]');
    // Skeletons might be very fast, so we check if they exist or if cards increased
    await expect(async () => {
      const currentCards = await page.locator('[data-testid="product-card"]').count();
      const hasSkeletons = await skeletons.count() > 0;
      expect(currentCards > initialCards || hasSkeletons).toBeTruthy();
    }).toPass();

    // Wait for more products to load and skeletons to disappear
    await expect(async () => {
      const currentCards = await page.locator('[data-testid="product-card"]').count();
      expect(currentCards).toBeGreaterThan(initialCards);
    }).toPass({ timeout: 15000 });
  });

  test("should occupy 100% width and maintain layout across viewports", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const catalogContainer = page.locator('.animate-fade-in').first();
    
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 834, height: 1194 },
      { name: 'Mobile', width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500); // Wait for reflow
      
      const width = await catalogContainer.evaluate(el => el.getBoundingClientRect().width);
      // Verify it's taking roughly the full width (allowing for minimal scrollbar gutter if any)
      expect(width).toBeGreaterThan(vp.width - 20);
      
      // Visual regression check for each viewport
      await expect(page).toHaveScreenshot(`catalog-layout-${vp.name.toLowerCase()}.png`, {
        fullPage: false,
        mask: [page.locator('[data-testid="product-card"] img')] // mask dynamic images
      });
    }
  });

  test("should not crash with many products (virtualization safety)", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Scroll multiple times to load many pages
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
    }
    
    // Verify we have a significant number of cards
    const cardCount = await page.locator('[data-testid="product-card"]').count();
    expect(cardCount).toBeGreaterThan(50);
    
    // Check for "white screen" or errors
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('Runtime Error');
  });
});
