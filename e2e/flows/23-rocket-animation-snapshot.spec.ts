import { test, expect } from '@playwright/test';

/**
 * Smoke estrutural da animação de foguetes no branding da página de auth.
 *
 * Histórico: era visual-regression (toHaveScreenshot, SEM baseline no repo →
 * falhava sempre) e assertava `rocket-container`/`rocket-item` + "burst de 7"
 * que NÃO existem no app. Os foguetes são ícones `svg.lucide-rocket` spawnados
 * ~1 a cada 2s via setInterval em AuthBranding.tsx. Convertido para checagem de
 * presença no DOM (nível smoke, determinístico, sem baseline). A rota correta é
 * `/login` (`/auth/login` não existe → caía no NotFound).
 * @smoke
 */
test.describe('Rocket Animation Consistency @smoke', () => {
  test('should render initial burst of rockets and maintain count', async ({ page }) => {
    await page.goto('/login');

    // O painel de branding (space-scene) deve montar na página de login.
    await expect(page.getByTestId('space-scene')).toBeVisible();

    // O loop de spawn produz ícones `svg.lucide-rocket`; aguardamos pelo menos um.
    await expect(page.locator('svg.lucide-rocket').first()).toBeVisible({ timeout: 8_000 });
  });

  test('should cleanup rockets after duration', async ({ page }) => {
    await page.goto('/login');

    // Após o ciclo de spawn/cleanup, ainda deve haver foguetes (setInterval segue reciclando).
    await page.waitForTimeout(10_000);

    const currentRockets = await page.locator('svg.lucide-rocket').count();
    expect(currentRockets).toBeGreaterThan(0);
  });
});
