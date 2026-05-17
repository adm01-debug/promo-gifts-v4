import { test, expect } from '@playwright/test';

/**
 * Teste de regressão visual para garantir que o layout da página de login
 * e o brilho das estrelas permaneçam consistentes.
 */
test.describe('Auth Page Visual Regression @smoke', () => {
  // Ignoramos a dependência de auth para este teste específico de branding
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should match visual snapshot for the space scene branding', async ({ page }) => {
    // 1. Mock do Math.random para garantir determinismo
    await page.addInitScript(() => {
      let count = 0;
      const values = Array.from({ length: 1000 }, (_, i) => (Math.sin(i * 999) + 1) / 2);
      Math.random = () => values[count++ % values.length];
    });

    // 2. Navegação para área pública
    await page.goto('/auth/login');

    // 3. Aguardar estabilização
    await expect(page.getByTestId('space-scene')).toBeVisible();
    await expect(page.getByTestId(/^star-breathing-/).first()).toBeVisible();

    // 4. Pausar animações
    await page.addStyleTag({
      content: `*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }`
    });

    // 5. Capturar snapshot
    const brandingPanel = page.locator('.lg\\:flex.lg\\:w-1\\/2');
    const viewportSize = page.viewportSize();
    
    if (viewportSize && viewportSize.width >= 1024) {
      await expect(brandingPanel).toHaveScreenshot('auth-branding-space-scene.png', {
        maxDiffPixelRatio: 0.05,
        threshold: 0.2,
      });
    } else {
      await expect(page.getByTestId('space-scene')).toHaveScreenshot('auth-mobile-space-scene.png', {
        maxDiffPixelRatio: 0.05,
      });
    }
  });

  test('should verify star brightness presence in DOM', async ({ page }) => {
    await page.goto('/auth/login');
    const firstStar = page.getByTestId(/^star-breathing-/).first();
    await expect(firstStar).toBeVisible();
    
    const boxShadow = await firstStar.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(boxShadow.split(',').length).toBeGreaterThanOrEqual(1);
    expect(boxShadow).toContain('rgb(59, 130, 246)');
  });
});

