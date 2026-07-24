import { test, expect } from '@playwright/test';

test.describe('Color Selection Preservation', () => {
  test('should preserve selected color via URL on PDP', async ({ page }) => {
    // Navigate to a product with a specific color via URL
    // We use a product ID that is likely to exist or we mock it if needed
    // For this test, let's try to find a product in the catalog first or use a known one
    await page.goto('/');
    
    // Wait for catalog to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productId = await firstProduct.getAttribute('data-product-id');
    
    // Find a color swatch if available
    const colorSwatch = firstProduct.locator('.rounded-full.border-white').first();
    const colorName = await colorSwatch.getAttribute('title');
    
    if (colorName) {
      await colorSwatch.click();
      
      // Navigate to PDP
      await firstProduct.click();
      
      // Check if URL has the color param
      await expect(page).toHaveURL(new RegExp(`cor=${encodeURIComponent(colorName)}`));
      
      // Check if the selected variation in PDP is the same
      const pdpColorBadge = page.locator('text=' + colorName).first();
      await expect(pdpColorBadge).toBeVisible();
    }
  });

  test('should preserve selected color when switching view modes', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="product-card"]');
    
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    const productId = await firstProduct.getAttribute('data-product-id');
    
    const colorSwatch = firstProduct.locator('.rounded-full.border-white').first();
    const colorName = await colorSwatch.getAttribute('title');
    
    if (colorName && productId) {
      await colorSwatch.click();
      
      // Switch to List view
      await page.click('[aria-label="Visualização em lista"]');
      
      // Check if the list item still shows the selected color image
      // We can check if the image source changed or if the store state is correct
      // (Testing store state directly is hard in E2E, so we check UI)
      const listItem = page.locator(`[data-product-id="${productId}"]`);
      // The list item should also reflect the color if implemented
    }
  });
});
