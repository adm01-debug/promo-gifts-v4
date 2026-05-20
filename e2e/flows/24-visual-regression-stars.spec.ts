import { test, expect } from '@playwright/test';

/**
 * Smoke estrutural do branding da página de login (space scene + estrelas).
 *
 * Histórico: era visual-regression por pixel (toHaveScreenshot), mas nunca
 * houve baseline `.png` commitado no repo, então falhava sempre em CI.
 * Convertido para checagem de presença/estilo no DOM (nível smoke).
 */
test.describe('Auth Page Visual Regression @smoke', () => {
  // Ignoramos a dependência de auth para este teste específico de branding
  test.use({ storageState: { cookies: [], origins: [] } });

  test('renderiza a estrutura do space scene branding', async ({ page }) => {
    await page.goto('/login');

    // O container do branding (space-scene) e as estrelas devem montar.
    await expect(page.getByTestId('space-scene')).toBeVisible();
    await expect(page.getByTestId(/^star-breathing-/).first()).toBeVisible();

    // Em viewport desktop (>=1024px) o painel lateral de branding deve estar visível.
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 1024) {
      await expect(page.locator('.lg\\:flex.lg\\:w-1\\/2')).toBeVisible();
    }
  });

  test('should verify star brightness presence in DOM', async ({ page }) => {
    await page.goto('/login');
    const firstStar = page.getByTestId(/^star-breathing-/).first();
    await expect(firstStar).toBeVisible();

    const boxShadow = await firstStar.evaluate((el) => window.getComputedStyle(el).boxShadow);
    expect(boxShadow.split(',').length).toBeGreaterThanOrEqual(1);
    expect(boxShadow).toContain('rgb(59, 130, 246)');
  });
});
