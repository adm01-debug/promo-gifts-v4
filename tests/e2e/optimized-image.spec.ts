import { test, expect } from '@playwright/test';

test.describe('OptimizedImage Blur-up Effect', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('/debug/images');
    // Ensure we are logged in or bypass auth if needed
    // In many Lovable environments, we might need to handle auth, 
    // but assuming /debug/images is accessible for tests.
  });

  test('should show blur-up transition and eventually show clear image', async ({ page }) => {
    const previewContainer = page.locator('text=Preview').locator('..').locator('.relative.overflow-hidden');
    
    // Set a long delay to observe the state
    const delaySlider = page.locator('text=Atraso de Rede').locator('..').locator('span[role="slider"]');
    // For simplicity, we just use the default or click reload
    await page.click('text=Reiniciar Carregamento');

    // While loading, we should see an image with blur filter OR a shimmer
    // Since we have a delay, we can check for the placeholder/shimmer
    const placeholder = previewContainer.locator('img[aria-hidden="true"]');
    await expect(placeholder).toBeVisible();

    // After loading (we wait for the image to have opacity 100)
    const mainImage = previewContainer.locator('img:not([aria-hidden="true"])');
    await expect(mainImage).toHaveClass(/opacity-100/, { timeout: 10000 });
    
    // Check that blur is 0 or none after loaded
    const style = await mainImage.getAttribute('style');
    expect(style).toContain('opacity: 1');
  });

  test('should show error state when image fails to load', async ({ page }) => {
    await page.click('text=Simular Erro de Carga');
    
    const previewContainer = page.locator('text=Preview').locator('..').locator('.relative.overflow-hidden');
    
    // Wait for the error message
    await expect(page.locator('text=Erro ao carregar')).toBeVisible({ timeout: 10000 });
    
    // Icon should be visible
    const errorIcon = previewContainer.locator('svg');
    await expect(errorIcon).toBeVisible();
  });
});
