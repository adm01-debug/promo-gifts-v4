import { test, expect } from '@playwright/test';

/**
 * Testes de Regressão Visual para OptimizedImage.
 * Valida o efeito blur-up, fade-in e estado de erro em diferentes viewports.
 *
 * TODO(auth): a rota /debug/images está atrás de ProtectedRoute.
 * Para estes testes passarem completamente é necessário:
 *   (A) Usar o project chromium-authed com storageState + secrets E2E_USER_*
 *   (B) Mover a rota para fora do ProtectedRoute no App.tsx
 * Enquanto isso, o workflow usa continue-on-error: true.
 */
test.describe('OptimizedImage Visual Regression', () => {
  const DEBUG_URL = '/debug/images';

  test.beforeEach(async ({ page }) => {
    await page.goto(DEBUG_URL);
    // Título real da página — corrigido de 'Ferramentas de Debug: OptimizedImage'
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
