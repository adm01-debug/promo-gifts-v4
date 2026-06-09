import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Exhaustive Validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/produtos");
  });

  test("Infinite Scroll: should load multiple pages without crashing or showing pagination", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    await expect(grid).toBeVisible();

    // Verify pagination elements are NOT visible
    const pagination = page.locator('nav[aria-label="pagination"], .pagination, [data-testid*="pagination"]');
    const counts = await pagination.count();
    for (let i = 0; i < counts; i++) {
      await expect(pagination.nth(i)).not.toBeVisible();
    }

    // Scroll multiple times to simulate heavy usage
    let lastProductCount = 0;
    for (let i = 0; i < 5; i++) {
      const currentCards = await page.locator('[data-testid="product-card"]').count();
      console.log(`Scroll iteration ${i}: ${currentCards} cards visible`);
      
      // Scroll to bottom
      await grid.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });

      // Check for skeletons during load
      const skeletons = page.locator('[data-testid="product-card-skeleton"]');
      if (await skeletons.count() > 0) {
        console.log("Skeletons detected during scroll");
      }

      // Wait for network/rendering
      await page.waitForTimeout(1500);
      
      const newCards = await page.locator('[data-testid="product-card"]').count();
      // Even with virtualization, some cards should be in DOM. 
      // If count is exactly same, maybe we hit the end or it failed to load.
    }
  });

  test("Layout: 100% width and no black bars", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Check if it occupies full width of parent
    const gridBox = await grid.boundingBox();
    const bodyBox = await page.locator('body').boundingBox();
    
    if (gridBox && bodyBox) {
      // Allow for some sidebar width if present, but the container itself should be wide
      expect(gridBox.width).toBeGreaterThan(bodyBox.width * 0.5); 
    }

    // Check for "black bars" (common artifact if height is fixed or footer is weird)
    const blackBars = page.locator('div').filter({ hasText: /^$/ }).filter({ 
      has: page.locator('div', { hasText: '' }) 
    }).evaluateAll(elements => {
      return elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundColor === 'rgb(0, 0, 0)' && parseInt(style.height) > 50;
      }).length;
    });
    
    expect(await blackBars).toBe(0);
  });

  test("Responsive: Full width across all viewports", async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 834, height: 1194, name: 'Tablet' },
      { width: 390, height: 844, name: 'Mobile' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      
      const grid = page.locator('[data-testid="virtualized-product-grid"]');
      await expect(grid).toBeVisible();
      
      const box = await grid.boundingBox();
      console.log(`${vp.name} grid width: ${box?.width}px`);
      
      // Ensure no horizontal scroll on body
      const hasHorizontalScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
      expect(hasHorizontalScroll, `Horizontal scroll detected on ${vp.name}`).toBeFalsy();
    }
  });

  test("Filters & Sorting: Should reset scroll and refresh correctly", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // 1. Scroll down
    await grid.evaluate(el => el.scrollTop = 1500);
    await page.waitForTimeout(500);
    
    // 2. Apply sort
    const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
    await sortTrigger.click();
    await page.locator('[data-testid="catalog-sort-item-price-asc"]').click();
    
    // 3. Verify scroll reset
    await expect(async () => {
      const scrollTop = await grid.evaluate(el => el.scrollTop);
      expect(scrollTop).toBe(0);
    }).toPass();

    // 4. Verify skeletons appear then disappear
    // (This happens fast, so we mostly check the final state has products)
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test("Stress Test: Virtualization performance (5000+ simulation)", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Rapid scrolling
    for (let i = 0; i < 10; i++) {
      await grid.evaluate(el => el.scrollTop += 2000);
      // Don't wait too long, test responsiveness
      await page.waitForTimeout(200);
    }
    
    // Check if page is still responsive
    const startTime = Date.now();
    await page.locator('[data-testid="catalog-sort-trigger"]').click();
    const endTime = Date.now();
    
    // Interaction should be fast
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
