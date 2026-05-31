import { test, expect } from '@playwright/test';

test.describe('Product Gallery - No Tooltip on Image', () => {
  // Use a known product ID for testing. 
  // In a real environment, we'd use a dynamic ID or a seed product.
  const productId = 'bea8bd6e-14f4-4482-921d-ecc179391166';

  test('should not show tooltip when hovering product photo in PDP', async ({ page }) => {
    // Navigate to product detail page
    // We assume auth is handled via storageState if required, 
    // or the page is accessible.
    await page.goto(`/produto/${productId}`);
    
    // Find the main product image in ProductGallery
    const mainImage = page.locator('.aspect-\\[4\\/3\\] img').first();
    
    // Ensure image is visible
    await expect(mainImage).toBeVisible();
    
    // Check for native title attribute - should be null/empty
    const titleAttr = await mainImage.getAttribute('title');
    expect(titleAttr).toBeFalsy();
    
    // Hover and wait for the global 1000ms delay to ensure no tooltip appears
    await mainImage.hover();
    await page.waitForTimeout(1200);
    
    // Check that no tooltip content from Radix/Shadcn is visible
    // These typically have data-radix-tooltip-content or role="tooltip"
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content]');
    await expect(tooltip).not.toBeVisible();
  });

  test('should not show tooltip when hovering product photo in QuickView', async ({ page }) => {
    // Navigate to products list to find a quick view trigger
    await page.goto('/produtos');
    
    // Wait for product cards to load
    const firstProductCard = page.locator('[data-testid^="product-card-"]').first();
    await expect(firstProductCard).toBeVisible();
    
    // Hover to reveal QuickView button if it's hidden
    await firstProductCard.hover();
    
    // Click QuickView button (usually eye icon or "Visualização Rápida")
    const quickViewBtn = firstProductCard.locator('button[aria-label="Visualização rápida"]');
    if (await quickViewBtn.isVisible()) {
      await quickViewBtn.click();
    } else {
      // Fallback: try to find any button that might open QuickView
      await page.keyboard.press('q'); // Some apps have 'q' as shortcut
    }
    
    // Find the main image in QuickView dialog
    const quickViewImage = page.locator('.QuickViewGallery img').first();
    
    // If it's not found with that selector, try a broader one
    // based on the QuickViewGallery structure
    const imageInDialog = page.locator('role=dialog >> img').first();
    
    await expect(imageInDialog).toBeVisible();
    
    // Check for native title attribute
    const titleAttr = await imageInDialog.getAttribute('title');
    expect(titleAttr).toBeFalsy();
    
    // Hover and wait
    await imageInDialog.hover();
    await page.waitForTimeout(1200);
    
    // Check for tooltip
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content]');
    await expect(tooltip).not.toBeVisible();
  });
});
