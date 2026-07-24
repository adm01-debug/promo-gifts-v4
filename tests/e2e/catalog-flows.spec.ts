/**
 * E2E: Catalog - Full User Flows & Critical Paths
 * Covers: Filter combinations, layout switching, bulk actions, and deep linking.
 */
import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Catalog Full Flows", () => {
  test.beforeEach(async ({ page }) => {
    // Assuming the user is already logged in via global setup or fixtures
    await gotoAndSettle(page, "/produtos");
  });

  test("Flow: Complete Search to Bulk Action", async ({ page }) => {
    // 1. Search for a term
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("Caneca");
      await page.keyboard.press("Enter");
    }

    // 2. Apply a filter (Category)
    await page.locator('[data-testid="filter-section-categorias"]').click();
    const firstCategory = page.locator('[data-testid="category-filter-item"]').first();
    await firstCategory.click();

    // 3. Switch Layout
    const layoutTrigger = page.locator('[data-testid="layout-popover-trigger"]');
    await layoutTrigger.click();
    await page.locator('button:has-text("Lista")').click();

    // 4. Enter Selection Mode
    await page.locator('button:has-text("Selecionar")').click();
    
    // 5. Select items
    const checkBoxes = page.locator('[data-testid="product-card-checkbox"]');
    const count = await checkBoxes.count();
    if (count > 0) {
      await checkBoxes.nth(0).click();
      if (count > 1) await checkBoxes.nth(1).click();
      
      // 6. Verify bulk action bar visibility
      await expect(page.locator('[data-testid="bulk-actions-bar"]')).toBeVisible();
      await expect(page.locator('button:has-text("Limpar Seleção")')).toBeVisible();
    }
  });

  test("Flow: Deep Linking & Sharing State", async ({ page }) => {
    // Simulate a user arriving with complex filters via URL
    const complexUrl = "/produtos?priceRange=10&priceRange=500&sortBy=newest&categories=cat-123";
    await gotoAndSettle(page, complexUrl);
    
    // Verify toolbar reflects URL state
    await expect(page.locator('[data-testid="active-filter-badge"]')).toBeVisible();
    
    // Check if sorting is correct
    const sortValue = await page.locator('[data-testid="catalog-sort-trigger"]').innerText();
    // This depends on translations/labels
    expect(sortValue).not.toBe("Ordenar"); 
  });

  test("Responsiveness: Toolbar Alignment", async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 800 });
    const toolbar = page.locator('.flex-col.sm\\:flex-row'); // Selector based on CatalogToolbar.tsx
    await expect(toolbar).toBeVisible();
    
    // Check right-aligned buttons in desktop (Selection/Layout)
    const actionGroup = page.locator('div:has(button:has-text("Selecionar"))');
    const box = await actionGroup.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThan(600); // Should be on the right half
    }

    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    // In mobile, they should stack or be accessible
    await expect(page.locator('button:has-text("Selecionar")')).toBeVisible();
    await expect(page.locator('[data-testid="layout-popover-trigger"]')).toBeVisible();
  });
});
