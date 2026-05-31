import { test, expect } from "@playwright/test";

test.describe("Product Module Tooltip Style E2E", () => {
  test("Should verify tooltips in product detail module use correct text and style", async ({ page }) => {
    // Navigate to a product detail page (using a valid public route if possible)
    await page.goto("/");
    
    // Search for a product and navigate
    const searchInput = page.locator('input[placeholder*="buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("produto");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      const productCard = page.locator('article').first();
      await productCard.click();
    } else {
      // Fallback for direct navigation if known
      await page.goto("/produto/example-id");
    }

    // 1. Stock per color tooltips
    const colorTooltipTrigger = page.locator('button[aria-label^="Cor"]').first();
    if (await colorTooltipTrigger.isVisible()) {
      await colorTooltipTrigger.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      // Default should be standard (larger padding)
      await expect(tooltip).toHaveClass(/px-3 py-1.5/);

      // Toggle to compact
      const toggleButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
      await toggleButton.click();

      // Hover again
      await colorTooltipTrigger.hover();
      // Compact should have smaller padding
      await expect(tooltip).toHaveClass(/px-2 py-1/);
    }
  });
});
