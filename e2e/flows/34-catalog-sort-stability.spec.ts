import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Catalog Layout Stability during Sorting", () => {
  test.beforeEach(() => requireAuth());

  test("viewMode and gridColumns remain constant when changing sortBy", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // 1. Check current layout is Grid (default)
    const productGrid = page.locator('.grid').first();
    await expect(productGrid).toBeVisible();

    // 2. Change sort to Price Asc
    const sortTrigger = page.locator(Sel.catalog.sortTrigger);
    await sortTrigger.click();
    await page.locator(Sel.catalog.sortItem('price-asc')).click();

    // 3. Verify that the grid doesn't disappear and layout remains stable
    // Our fix prevents shouldShowCatalogSkeleton from being true during transition
    await expect(productGrid).toBeVisible();
    
    // 4. Switch to List view
    const layoutTrigger = page.locator('[data-testid="layout-popover-trigger"]');
    await layoutTrigger.click();
    await page.getByRole('button', { name: /Lista/i }).click();
    await page.keyboard.press("Escape");

    // 5. Verify List view
    const listItem = page.locator('[data-testid^="product-list-name"]').first();
    await expect(listItem).toBeVisible();

    // 6. Change sort back to Name
    await sortTrigger.click();
    await page.locator(Sel.catalog.sortItem('name')).click();

    // 7. Verify we are STILL in list view during/after transition
    await expect(listItem).toBeVisible();
    
    // Ensure grid didn't flicker in
    await expect(productGrid).not.toBeVisible();
  });
});
