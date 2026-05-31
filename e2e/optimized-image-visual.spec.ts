import { test, expect } from '@playwright/test';
import { gotoAndSettle } from './helpers/nav';

/**
 * Testes de Regressão Visual para OptimizedImage.
 * Valida o efeito blur-up, fade-in e estado de erro em diferentes viewports.
 *
 * A rota /debug/images é pública (sem ProtectedRoute) em todos os ambientes.
 * Executa exclusivamente no project routes-public (chromium).
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
    await expect(image).toHaveCSS('opacity', '1');
    await expect(image).toHaveScreenshot('image-loaded-final.png', { threshold: 0.2 });
  });

  test('should match error state', async ({ page }) => {
    const errorToggle = page.getByLabel('Simular Erro');
    if (await errorToggle.isVisible()) {
      await errorToggle.check();
    } else {
      const errorCard = page.locator('div:has-text("Erro ao carregar")').first();
      await expect(errorCard).toBeVisible();
      await expect(errorCard).toHaveScreenshot('image-error-state.png');
    }
  });

  test('should be responsive (mobile viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const imageContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(imageContainer).toBeVisible();
    await expect(imageContainer).toHaveScreenshot('image-responsive-mobile.png');
  });
});
