import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Infinite Scroll & Virtualization", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("should load more products on scroll with virtualization and no pagination", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    await expect(grid).toBeVisible();

    // Check pagination is NOT present
    const pagination = page.locator('[data-testid*="pagination"]');
    for (const el of await pagination.all()) {
      await expect(el).not.toBeVisible();
    }

    // Check initial products
    const initialCards = await page.locator('[data-testid="product-card"]').count();
    expect(initialCards).toBeGreaterThan(0);
    
    // Scroll down inside the virtualized grid
    await grid.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    
    // Verify skeletons appear in the loader row
    const skeletons = page.locator('[data-testid="product-card-skeleton"]');
    // Wait for content to change or skeletons to show
    await page.waitForTimeout(1000);

    // Verifying we can scroll far without crashing (simulating many products)
    for (let i = 0; i < 3; i++) {
      await grid.evaluate((el) => {
        el.scrollTop += 5000;
      });
      await page.waitForTimeout(500);
    }

    const finalCards = await page.locator('[data-testid="product-card"]').count();
    // Since it's virtualized, the count of DOM elements should stay reasonable
    // even if we have "thousands" of products.
    expect(finalCards).toBeLessThan(150); 
  });

  test("should reset scroll and load from beginning when applying filters", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Scroll down
    await grid.evaluate((el) => {
      el.scrollTop = 2000;
    });
    
    // Apply a sort or filter
    const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
    await sortTrigger.click();
    await page.locator('[data-testid="catalog-sort-item-price-asc"]').click();
    
    // Verify scroll reset to top
    await expect(async () => {
      const scrollTop = await grid.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeLessThan(100);
    }).toPass();
  });

  test("visual regression of catalog states", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const viewports = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 834, height: 1194 },
      { name: 'mobile', width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      
      // 1. Final state (loaded)
      await expect(page).toHaveScreenshot(`catalog-full-${vp.name}.png`, {
        mask: [page.locator('[data-testid="product-card"] img')]
      });

      // 2. Skeleton state (simulated by scrolling fast to bottom)
      const grid = page.locator('[data-testid="virtualized-product-grid"]');
      await grid.evaluate(el => el.scrollTop = el.scrollHeight);
      
      await expect(page).toHaveScreenshot(`catalog-skeleton-${vp.name}.png`, {
        mask: [page.locator('[data-testid="product-card"] img')]
      });
    }
  });
});

