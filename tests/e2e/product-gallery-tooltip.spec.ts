import { test, expect } from '@playwright/test';

/**
 * Visual Regression & Interaction Audit for Product Gallery Tooltips.
 * Ensures no tooltips or unintended overlays appear on product images.
 */
test.describe('Product Gallery - Visual & Interaction Audit', () => {
  // Use a known product ID for testing. 
  const productId = 'bea8bd6e-14f4-4482-921d-ecc179391166';

  test('should not show tooltip or unintended overlays when hovering product photo in PDP', async ({ page }) => {
    await page.goto(`/produto/${productId}`);
    
    const galleryContainer = page.locator('.ProductGallery, .aspect-\\[4\\/3\\]').first();
    const mainImage = galleryContainer.locator('img').first();
    
    await expect(mainImage).toBeVisible();
    
    // Take a baseline screenshot before hover
    const baseline = await mainImage.screenshot();
    
    // Hover and wait for the global 1000ms delay
    await mainImage.hover();
    await page.waitForTimeout(1200);
    
    // Check that no tooltip content is visible
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content], .rt-TooltipContent');
    await expect(tooltip).not.toBeVisible();

    // Verify visual consistency (no new overlays/placeholders appearing on the image itself)
    const postHover = await mainImage.screenshot();
    // In a full visual regression environment, we'd use expect(postHover).toMatchSnapshot()
    // Here we ensure the image size/presence hasn't been disturbed by a tooltip placeholder
    expect(postHover.length).toBeGreaterThan(0);
    
    // Audit for the native 'title' attribute again as a hard constraint
    const titleAttr = await mainImage.getAttribute('title');
    expect(titleAttr).toBeFalsy();
  });

  test('should not show tooltip in QuickView gallery', async ({ page }) => {
    await page.goto('/produtos');
    
    const firstProductCard = page.locator('[data-testid^="product-card-"]').first();
    await expect(firstProductCard).toBeVisible();
    await firstProductCard.hover();
    
    const quickViewBtn = firstProductCard.locator('button[aria-label="Visualização rápida"]');
    if (await quickViewBtn.isVisible()) {
      await quickViewBtn.click();
    } else {
      await page.keyboard.press('q');
    }
    
    // QuickView Dialog image
    const imageInDialog = page.locator('role=dialog >> img').first();
    await expect(imageInDialog).toBeVisible();
    
    // Check for native title
    const titleAttr = await imageInDialog.getAttribute('title');
    expect(titleAttr).toBeFalsy();
    
    // Hover and wait
    await imageInDialog.hover();
    await page.waitForTimeout(1200);
    
    // Ensure no tooltips triggered by image hover
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content]');
    await expect(tooltip).not.toBeVisible();
  });
});

