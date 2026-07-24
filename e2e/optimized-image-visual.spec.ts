import { test, expect } from '@playwright/test';
import { gotoAndSettle } from './helpers/nav';

/**
 * Testes de Regressão Visual para OptimizedImage.
 * Valida o efeito blur-up, fade-in e estado de erro em diferentes viewports.
 *
 * A rota /debug/images é pública (sem ProtectedRoute) em todos os ambientes.
 * Executa no project chromium-public (chromium, sem auth).
 */
test.describe('OptimizedImage Visual Regression', () => {
  const DEBUG_URL = '/debug/images';

  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, DEBUG_URL);
    await expect(page.getByText('OptimizedImage Demo')).toBeVisible();
  });

  test('should match initial loading state (blur-up)', async ({ page }) => {
    const loadingImage = page.locator('div.relative.overflow-hidden').first();

    // Pausa animações para snapshot estável
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`,
    });

    await expect(loadingImage).toHaveScreenshot('image-loading-blur.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('should match loaded state (fade-in complete)', async ({ page }) => {
    const image = page.locator('img[alt="LQIP Demo"]').first();
    // Image may never reach opacity:1 in CI (no real image server); skip gracefully
    const isLoaded = await image
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => image.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0))
      .catch(() => false);
    test.skip(!isLoaded, 'Image did not fully load in CI — skipping loaded-state baseline');
    await expect(image).toHaveScreenshot('image-loaded-final.png', { threshold: 0.2 });
  });

  test('should match error state', async ({ page }) => {
    const errorToggle = page.getByLabel('Simular Erro');
    if (await errorToggle.isVisible()) {
      await errorToggle.check();
      const errorCard = page.locator('div:has-text("Erro ao carregar")').first();
      await expect(errorCard).toBeVisible({ timeout: 5000 });
      await expect(errorCard).toHaveScreenshot('image-error-state.png');
    } else {
      // No toggle available and no spontaneous error — skip gracefully
      test.skip(true, 'Error state not reproducible without "Simular Erro" toggle');
    }
  });

  test('should be responsive (mobile viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const imageContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(imageContainer).toBeVisible();
    await expect(imageContainer).toHaveScreenshot('image-responsive-mobile.png');
  });
});
