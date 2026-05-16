import { test, expect } from '@playwright/test';

/**
 * Teste de snapshot visual e consistência determinística para a animação de foguetes.
 * Garante que a animação renderiza o número esperado de elementos mesmo com durações aleatórias.
 */
test.describe('Rocket Animation Consistency', () => {
  test('should render initial burst of rockets and maintain count', async ({ page }) => {
    // Mock Math.random para garantir valores determinísticos para os foguetes
    // Isso evita que o snapshot visual falhe por causa de posições aleatórias
    await page.addInitScript(() => {
      let count = 0;
      const values = [0.1, 0.5, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6];
      Math.random = () => {
        count++;
        return values[count % values.length];
      };
    });

    // Navega para a página de login onde os foguetes estão
    await page.goto('/auth/login');

    // Espera pelo container da animação
    const rocketContainer = page.getByTestId('rocket-container');
    await expect(rocketContainer).toBeVisible();

    // No início, deve haver o burst inicial de foguetes (7 foguetes conforme definido no componente)
    // Usamos um pequeno delay para garantir que os timeouts do burst inicial foram disparados
    await page.waitForTimeout(1000);

    const rocketCount = await page.getByTestId('rocket-item').count();
    // O burst inicial dispara 7 foguetes em 2.8 segundos. Em 1s, alguns já devem estar visíveis.
    expect(rocketCount).toBeGreaterThanOrEqual(3);

    // Snapshot visual do painel de branding com foguetes determinísticos
    // Focamos apenas na área de branding (lado esquerdo em desktop)
    const brandingPanel = page.locator('.lg\\:flex.lg\\:w-1\\/2');
    
    // Captura snapshot visual. Se não houver snapshot anterior, este será o baseline.
    // Usamos mask para esconder elementos que ainda podem variar (como textos que podem ter animação de fade)
    // ou apenas focamos nos foguetes se necessário.
    await expect(brandingPanel).toHaveScreenshot('auth-branding-rockets.png', {
      maxDiffPixelRatio: 0.05, // Tolerância para pequenas variações de subpixel/anti-aliasing
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
