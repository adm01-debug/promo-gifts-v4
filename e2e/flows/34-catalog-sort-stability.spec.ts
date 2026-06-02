import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Catalog Layout Stability during Sorting", () => {
  test.beforeEach(() => requireAuth());

  test("viewMode and gridColumns remain constant when changing sortBy", async ({ page }) => {
    // 1. Navigate to catalog
    await gotoAndSettle(page, "/produtos");
    
    // 2. Open layout popover and set a specific layout (e.g., 4 columns)
    const layoutTrigger = page.locator(Sel.app.layout.header).isVisible() 
      ? page.locator('[data-testid="layout-popover-trigger"]') 
      : page.locator('[data-testid="layout-popover-trigger"]');
      
    await layoutTrigger.click();
    const grid4Option = page.locator('[data-testid="column-option-4"]');
    await grid4Option.click();
    
    // Close popover (click outside or Esc)
    await page.keyboard.press("Escape");

    // 3. Verify initial state (Grid, 4 columns)
    // We check the product grid class or attribute
    const productGrid = page.locator('.grid');
    await expect(productGrid).toHaveClass(/grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/);

    // 4. Change sortBy
    const sortTrigger = page.locator(Sel.catalog.sortTrigger);
    await sortTrigger.click();
    
    // Select 'Price Asc'
    const sortItemPriceAsc = page.locator(Sel.catalog.sortItem('price-asc'));
    await sortItemPriceAsc.click();

    // 5. Verify layout is still 4 columns and Grid
    // Wait for any potential flicker or transition
    await page.waitForTimeout(500);
    
    await expect(productGrid).toBeVisible();
    await expect(productGrid).toHaveClass(/grid-cols-2 sm:grid-cols-3 lg:grid-cols-4/);
    
    // 6. Switch to List view
    await layoutTrigger.click();
    const listViewBtn = page.getByRole('button', { name: /Lista/i });
    await listViewBtn.click();
    await page.keyboard.press("Escape");
    
    // Verify List view is active (ProductList component usually has a specific class or testid)
    const productList = page.locator('[data-testid^="product-list-name"]').first();
    await expect(productList).toBeVisible();

    // 7. Change sortBy again
    await sortTrigger.click();
    const sortItemName = page.locator(Sel.catalog.sortItem('name'));
    await sortItemName.click();

    // 8. Verify still in List view
    await page.waitForTimeout(500);
    await expect(productList).toBeVisible();
    
    // Ensure grid is NOT visible
    await expect(productGrid).not.toBeVisible();
  });
});
