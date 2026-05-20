import { test, expect } from '@playwright/test';

/**
 * Smoke estrutural da animação de foguetes no branding da página de auth.
 *
 * Histórico: este spec era visual-regression (toHaveScreenshot) e assertava
 * `rocket-container`/`rocket-item` + um "burst de 7 foguetes". Porém (a) nunca
 * houve baseline de screenshot commitado no repo e (b) esses testids e esse
 * comportamento não existem no app — os foguetes são ícones `svg.lucide-rocket`
 * spawnados ~1 a cada 2s pelo setInterval em AuthBranding.tsx. Convertido para
 * checagem de presença no DOM (nível smoke, determinístico e sem baseline).
 * @smoke
 */
test.describe('Rocket Animation Consistency @smoke', () => {
  test('renderiza o branding animado (space-scene + foguetes) no /login', async ({ page }) => {
    await page.goto('/login');

    // O painel de branding (space-scene) deve montar na página de login.
    await expect(page.getByTestId('space-scene')).toBeVisible();

    // O loop de spawn (setInterval ~2s em AuthBranding.tsx) produz ícones
    // `svg.lucide-rocket`. Aguardamos pelo menos um aparecer no DOM.
    await expect(page.locator('svg.lucide-rocket').first()).toBeVisible({ timeout: 8_000 });
  });

  test('mantém foguetes sendo reciclados ao longo do tempo', async ({ page }) => {
    await page.goto('/login');

    // Após o ciclo de spawn/cleanup, ainda deve haver foguetes no DOM
    // (o setInterval continua reciclando).
    await page.waitForTimeout(10_000);

    const currentRockets = await page.locator('svg.lucide-rocket').count();
    expect(currentRockets).toBeGreaterThan(0);
  });
});
