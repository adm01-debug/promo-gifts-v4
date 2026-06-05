import { test, expect } from '@playwright/test';

test.describe('PromoFlixPlayer Visual Regression', () => {
  test.beforeEach(() => {
    // /promoflix-playground is under ProtectedRoute — skip when no auth credentials
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'E2E_USER_EMAIL/PASSWORD não configurados — visual baseline de rota autenticada indisponível',
    );
  });

  test('should render the player correctly on the playground page', async ({ page }) => {
    // Navigate to the playground (authed)
    await page.goto('/promoflix-playground');
    
    // Wait for the player container
    const player = page.locator('.group.relative.w-full.overflow-hidden.bg-black');
    await expect(player).toBeVisible();
    
    // Wait for the loading overlay to disappear (happy path)
    // The loading text says "Carregando"
    const loadingOverlay = page.locator('text=Carregando');
    
    // We expect it to be gone within a reasonable time if the video loads
    // If it's a real video, it might take time.
    // To be deterministic in visual tests, we might want to capture the loading state too.
    
    // 1. Capture Loading State (Visual Baseline)
    await expect(loadingOverlay).toBeVisible();
    await expect(page).toHaveScreenshot('promoflix-loading.png', {
      mask: [page.locator('video')], // Mask video to avoid dynamic frames
    });
    
    // 2. Wait for Loaded State
    await expect(loadingOverlay).toBeHidden({ timeout: 30000 });
    
    // Capture Fixed/Loaded State
    await expect(page).toHaveScreenshot('promoflix-loaded.png', {
      mask: [page.locator('video')],
    });
  });

  test('should show manual load button when stuck', async ({ page }) => {
    // Navigate to playground with a "stuck" simulate param if the page supports it
    // Or just wait 11s (the timeout in the component is 10s)
    await page.goto('/promoflix-playground?simulate=stuck');
    
    // Wait > 10s for the manual load button
    const manualLoadButton = page.locator('text=Carregar Manualmente');
    await expect(manualLoadButton).toBeVisible({ timeout: 15000 });
    
    await expect(page).toHaveScreenshot('promoflix-stuck-manual-load.png', {
      mask: [page.locator('video')],
    });
  });
});
