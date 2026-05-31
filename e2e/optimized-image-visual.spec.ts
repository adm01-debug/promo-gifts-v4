import { test, expect } from '@playwright/test';

/**
 * Testes de Regressão Visual para OptimizedImage.
 * Valida o efeito blur-up, fade-in e estado de erro em diferentes viewports.
 */
test.describe('OptimizedImage Visual Regression', () => {
  // Usamos a página de debug que já possui controles para simular diferentes estados
  const DEBUG_URL = '/debug/images';

  test.beforeEach(async ({ page }) => {
    await page.goto(DEBUG_URL);
    // Aguarda a página carregar
    await expect(page.getByText('Ferramentas de Debug: OptimizedImage')).toBeVisible();
  });

  test('should match initial loading state (blur-up)', async ({ page }) => {
    // Força um delay alto para capturar o estado de carregamento
    await page.fill('input[type="number"]', '5000'); // Delay de 5s
    
    // Recarrega a seção de teste clicando em algum controle que dispare re-render se necessário
    // Ou simplesmente usamos um dos exemplos que já deve estar carregando
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
    // Remove delay para carregar rápido
    await page.fill('input[type="number"]', '0');
    
    // Aguarda a imagem carregar (procuramos pela opacidade 100 ou ausência de skeleton/lqip visível)
    const image = page.locator('img[alt="Exemplo com LQIP"]').first();
    await expect(image).toHaveCSS('opacity', '1');
    
    await expect(image).toHaveScreenshot('image-loaded-final.png', {
      threshold: 0.2,
    });
  });

  test('should match error state', async ({ page }) => {
    // Ativa o toggle de erro se existir na página de debug
    const errorToggle = page.getByLabel('Simular Erro');
    if (await errorToggle.isVisible()) {
      await errorToggle.check();
    } else {
      // Fallback: tenta encontrar o card de erro na página
      const errorCard = page.locator('div:has-text("Erro ao carregar")').first();
      await expect(errorCard).toBeVisible();
      
      await expect(errorCard).toHaveScreenshot('image-error-state.png');
    }
  });

  test('should be responsive (mobile viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const imageContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(imageContainer).toBeVisible();
    
    // Verifica se o layout não quebrou
    await expect(imageContainer).toHaveScreenshot('image-responsive-mobile.png');
  });
});
