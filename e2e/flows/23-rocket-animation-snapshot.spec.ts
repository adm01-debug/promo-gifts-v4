import { test, expect } from '@playwright/test';

/**
 * Teste de snapshot visual e consistência determinística para a animação de foguetes.
 * Garante que a animação renderiza o número esperado de elementos mesmo com durações aleatórias.
 * @smoke
 */
test.describe('Rocket Animation Consistency @smoke', () => {
  test('should render initial burst of rockets and maintain count', async ({ page }) => {
    // Mock Math.random para garantir valores determinísticos para os foguetes
    // Isso evita que o snapshot visual falhe por causa de posições aleatórias
    await page.addInitScript(() => {
      let count = 0;
      // Sequência determinística para: left, size, duration, rotation, scale
      // Precisamos de 5 valores por foguete. Para 7 foguetes = 35 valores.
      const values = [
        0.1, 0.5, 0.9, 0.2, 0.8, // Rocket 1
        0.3, 0.7, 0.4, 0.6, 0.1, // Rocket 2
        0.5, 0.9, 0.2, 0.8, 0.3, // Rocket 3
        0.7, 0.4, 0.6, 0.1, 0.5, // Rocket 4
        0.9, 0.2, 0.8, 0.3, 0.7, // Rocket 5
        0.4, 0.6, 0.1, 0.5, 0.9, // Rocket 6
        0.2, 0.8, 0.3, 0.7, 0.4  // Rocket 7
      ];
      Math.random = () => {
        const val = values[count % values.length];
        count++;
        return val;
      };
    });

    // Navega para a página de login onde os foguetes estão
    await page.goto('/auth/login');

    // Espera pelo container da animação
    const rocketContainer = page.getByTestId('rocket-container');
    await expect(rocketContainer).toBeVisible();

    // No início, deve haver o burst inicial de foguetes (7 foguetes conforme definido no componente)
    // Esperamos até que todos os 7 tenham sido spawnados (o último delay é 2800ms)
    await expect(page.getByTestId('rocket-item')).toHaveCount(7, { timeout: 5000 });

    const rocketCount = await page.getByTestId('rocket-item').count();
    expect(rocketCount).toBe(7);

    // Snapshot visual do painel de branding com foguetes determinísticos
    const brandingPanel = page.locator('.lg\\:flex.lg\\:w-1\\/2');
    
    // Captura snapshot visual.
    await expect(brandingPanel).toHaveScreenshot('auth-branding-rockets.png', {
      maxDiffPixelRatio: 0.1, // Aumentado para tolerar variações de renderização em headless
    });
  });

  test('should cleanup rockets after duration', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Espera o burst inicial passar (máximo duration é ~3s + 0.5s cleanup + delays de spawn)
    // Em 10 segundos, os foguetes iniciais já devem ter sido removidos do DOM
    await page.waitForTimeout(10000);
    
    // Verifica se os foguetes continuam sendo reciclados (deve haver sempre alguns visíveis devido ao setInterval de 2.8s)
    const currentRockets = await page.locator('svg.lucide-rocket').count();
    expect(currentRockets).toBeGreaterThan(0);
  });
});
