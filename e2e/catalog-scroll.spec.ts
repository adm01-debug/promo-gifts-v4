import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Infinite Scroll & UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("should load more products on scroll and not show pagination", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Check pagination is NOT present
    const pagination = page.locator('[data-testid="pagination-next"]');
    await expect(pagination).not.toBeVisible();

    // Check black bar is NOT present (using a generic selector for common footer/bar classes if applicable)
    // Based on previous context, the user wanted to exclude a black bar at the end.
    const blackBar = page.locator('.bg-black, .bg-zinc-950').filter({ hasText: /página/i });
    await expect(blackBar).not.toBeVisible();

    // Count initial products
    const initialCards = await page.locator('[data-testid="product-card"]').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Wait for more products to load
    await expect(async () => {
      const currentCards = await page.locator('[data-testid="product-card"]').count();
      expect(currentCards).toBeGreaterThan(initialCards);
    }).toPass({ timeout: 10000 });
  });

  test("should occupy full width and handle responsive layout", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const catalogContainer = page.locator('.animate-fade-in').first();
    
    // Desktop check
    await page.setViewportSize({ width: 1920, height: 1080 });
    const desktopWidth = await catalogContainer.evaluate(el => el.clientWidth);
    expect(desktopWidth).toBeGreaterThan(1800);

    // Tablet check
    await page.setViewportSize({ width: 768, height: 1024 });
    const tabletWidth = await catalogContainer.evaluate(el => el.clientWidth);
    expect(tabletWidth).toBeCloseTo(768, -1); // Allow some padding

    // Mobile check
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileWidth = await catalogContainer.evaluate(el => el.clientWidth);
    expect(mobileWidth).toBeCloseTo(375, -1);
  });
});
