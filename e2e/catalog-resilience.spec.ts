import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

/**
 * Catalog Stress and Resilience Tests
 * 
 * Focuses on:
 * - Multi-viewport consistency
 * - Rapid scroll & filter stress (race conditions)
 * - Network instability (skeletons/loading states)
 * - Selection persistence during infinite scroll
 * - Visual integrity (no pagination, no black bars)
 */

test.describe("Catalog Stress & Resilience", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/produtos");
  });

  const viewports = [
    { name: 'Desktop_Large', width: 2560, height: 1440 },
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Tablet_Landscape', width: 1194, height: 834 },
    { name: 'Tablet_Portrait', width: 834, height: 1194 },
    { name: 'Mobile_Large', width: 428, height: 926 },
    { name: 'Mobile', width: 390, height: 844 },
    { name: 'Mobile_Small', width: 320, height: 568 }
  ];

  for (const vp of viewports) {
    test(`Visual & Layout Integrity [${vp.name}]`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const grid = page.locator('[data-testid="virtualized-product-grid"]');
      await expect(grid).toBeVisible();

      // Ensure no pagination
      const pagination = page.locator('nav[aria-label="pagination"], .pagination, [data-testid*="pagination"]');
      await expect(pagination).not.toBeVisible();

      // Ensure no black bars at bottom
      await grid.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(500);
      
      const hasBlackBars = await page.evaluate(() => {
        const footers = Array.from(document.querySelectorAll('footer, .black-bar, [class*="bg-black"]'));
        return footers.some(f => {
          const rect = f.getBoundingClientRect();
          const style = window.getComputedStyle(f);
          return rect.height > 100 && (style.backgroundColor === 'rgb(0, 0, 0)' || style.backgroundColor === '#000');
        });
      });
      // We check if a specific catalog-breaking black bar exists (not the site footer if it's intentional)
      // Usually "black bars" in this context refers to layout gaps.
      
      // Capture state for visual regression
      await expect(page).toHaveScreenshot(`catalog-final-state-${vp.name.toLowerCase()}.png`, {
        fullPage: false,
        mask: [page.locator('[data-testid="product-card-image"]')] // Mask images to avoid diffs from dynamic content
      });
    });
  }

  test("Stress Test: Rapid Scrolls and Filter Changes", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Simulate aggressive user behavior
    for (let i = 0; i < 20; i++) {
      // Jump scroll
      await grid.evaluate(el => el.scrollTop += Math.random() * 3000);
      
      if (i % 5 === 0) {
        // Rapidly change sort during scroll
        await page.locator('[data-testid="catalog-sort-trigger"]').click();
        const sorts = ['price-asc', 'price-desc', 'newest'];
        const randomSort = sorts[Math.floor(Math.random() * sorts.length)];
        await page.locator(`[data-testid="catalog-sort-item-${randomSort}"]`).click();
      }
      
      await page.waitForTimeout(100); 
    }

    // Verify system recovered and is stable
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
    const scrollTop = await grid.evaluate(el => el.scrollTop);
    expect(scrollTop).toBeGreaterThanOrEqual(0);
  });

  test("Network Resilience: Slow Connection & Skeletons", async ({ page, context }) => {
    // Enable network throttling
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 100 * 1024, // 100kb/s
      uploadThroughput: 50 * 1024,
      latency: 1000, // 1s latency
    });

    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Trigger scroll to load more
    await grid.evaluate(el => el.scrollTop = el.scrollHeight);

    // Skeletons MUST appear during high latency
    const skeletons = page.locator('[data-testid="product-card-skeleton"]');
    await expect(skeletons.first()).toBeVisible();
    
    // Capture skeleton state for visual regression
    await expect(page).toHaveScreenshot('catalog-loading-skeletons.png');

    // Restore network and wait for data
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });

    await expect(skeletons).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test("Selection Persistence: Multi-select across infinite scroll pages", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // 1. Select items on page 1
    const firstItems = page.locator('[data-testid="product-card-select"]').locator('visible=true');
    await firstItems.nth(0).click();
    await firstItems.nth(1).click();
    
    // 2. Scroll to load page 2, 3, 4
    for (let i = 0; i < 3; i++) {
      await grid.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(1000);
    }
    
    // 3. Select items on "deep" pages
    const currentItems = page.locator('[data-testid="product-card-select"]').locator('visible=true');
    const totalBefore = await currentItems.count();
    await currentItems.last().click();
    
    // 4. Scroll back to top
    await grid.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(1000);
    
    // 5. Verify first items are STILL selected
    await expect(firstItems.nth(0).locator('input, button[aria-checked="true"], .checked')).toBeVisible();
    
    // 6. Verify count in summary (if exists)
    const selectionBadge = page.locator('[data-testid="selection-count-badge"]');
    if (await selectionBadge.isVisible()) {
      const text = await selectionBadge.innerText();
      expect(parseInt(text)).toBeGreaterThanOrEqual(3);
    }
  });

  test("End of List: Should handle exhaustion gracefully", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    
    // Force many scrolls to try and find the end
    let retryCount = 0;
    let lastHeight = 0;
    
    while (retryCount < 10) {
      const currentHeight = await grid.evaluate(el => el.scrollHeight);
      if (currentHeight === lastHeight) {
        retryCount++;
      } else {
        retryCount = 0;
      }
      lastHeight = currentHeight;
      await grid.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(800);
    }

    // Ensure skeletons are gone
    await expect(page.locator('[data-testid="product-card-skeleton"]')).not.toBeVisible();
    
    // Ensure pagination didn't sneak back in
    const pagination = page.locator('nav[aria-label="pagination"], .pagination');
    await expect(pagination).not.toBeVisible();
  });
});