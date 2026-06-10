import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Selection Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/produtos");
  });

  test("BUG-CS-12: Should persist selection across virtualized scroll pages", async ({ page }) => {
    const grid = page.locator('[data-testid="virtualized-product-grid"]');
    await expect(grid).toBeVisible();

    // 1. Enable selection mode
    await page.locator('[data-testid="catalog-selection-mode-toggle"]').click();
    
    // 2. Select first 2 items (Page 1)
    const selectButtons = page.locator('[data-testid="product-card-select"]');
    await selectButtons.nth(0).click();
    await selectButtons.nth(1).click();
    
    // Check initial selection count in toolbar
    const toolbarCount = page.locator('[data-testid="catalog-selected-count"]');
    await expect(toolbarCount).toHaveText("2 selecionados");

    // 3. Scroll deep to unload Page 1 items from DOM (Virtualized)
    // We scroll several viewports down.
    for (let i = 0; i < 5; i++) {
      await grid.evaluate(el => el.scrollTop += 2000);
      await page.waitForTimeout(500);
    }
    
    // 4. Verify selection count is STILL 2 in the toolbar (Not cleared by virtualization)
    await expect(toolbarCount).toHaveText("2 selecionados");
    
    // 5. Select 1 more item on current deep page
    const currentSelectButtons = page.locator('[data-testid="product-card-select"]').locator('visible=true');
    await currentSelectButtons.first().click();
    
    // Total should be 3
    await expect(toolbarCount).toHaveText("3 selecionados");
    
    // 6. Scroll back to top
    await grid.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(1000);
    
    // 7. Verify first 2 items are STILL marked as selected in DOM
    // (They are back in DOM after scrolling up)
    await expect(selectButtons.nth(0).locator('input, button[aria-checked="true"], .checked')).toBeVisible();
    await expect(selectButtons.nth(1).locator('input, button[aria-checked="true"], .checked')).toBeVisible();
  });
});