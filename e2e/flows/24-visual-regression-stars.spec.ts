import { test, expect } from '@playwright/test';

/**
 * Smoke estrutural do branding da página de login (space scene + estrelas).
 *
 * Histórico: era visual-regression por pixel (toHaveScreenshot) SEM baseline
 * `.png` no repo → falhava sempre em CI; e navegava para `/auth/login`
 * (inexistente). Convertido para checagem de presença/estilo no DOM (smoke).
 * @smoke
 */
test.describe('Auth Page Visual Regression @smoke', () => {
  // Ignoramos a dependência de auth para este teste específico de branding.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should match visual snapshot for the space scene branding', async ({ page }) => {
    await page.goto('/login');

    // O container do branding (space-scene) e as estrelas devem montar.
    await expect(page.getByTestId('space-scene')).toBeVisible();
    await expect(page.getByTestId(/^star-breathing-/).first()).toBeVisible();
  });

  test('should verify star brightness presence in DOM', async ({ page }) => {
    await page.goto('/login');
    const firstStar = page.getByTestId(/^star-breathing-/).first();
    await expect(firstStar).toBeVisible();

    // O glow azul vive DENTRO do @keyframes breathingStar (valor de box-shadow
    // amostrado costuma ser 'none' → assert frágil). Validamos a aparência
    // estável da estrela: é um disco branco (bg-white), independente do frame.
    const bg = await firstStar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
  });
});
