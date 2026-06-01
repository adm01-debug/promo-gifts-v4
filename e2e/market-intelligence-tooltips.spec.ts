import { test, expect } from '@playwright/test';

/**
 * Testes E2E para validação de Tooltips na Inteligência de Mercado
 * Garante que os tooltips das 4 seções (KPIs) e dos badges aparecem corretamente.
 */
test.describe('Market Intelligence Tooltips', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navegar para uma página de produto que contenha o gráfico
    await page.goto('/produto/test-product');
    // Garantir que a seção de inteligência está visível
    const section = page.locator('div[aria-label="Métricas de inteligência de mercado"]');
    await section.scrollIntoViewIfNeeded();
  });

  test('should show tooltips for all 4 KPI sessions', async ({ page }) => {
    const infoButtons = page.locator('button[aria-label^="Sobre"]');
    await expect(infoButtons).toHaveCount(4);

    // Testar cada card individualmente
    const expectedTexts = [
      'Velocidade média de saída',
      'Nível de interesse atual',
      'Variação da procura',
      'Estoque total disponível'
    ];

    for (let i = 0; i < 4; i++) {
      const button = infoButtons.nth(i);
      await button.hover();
      
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(expectedTexts[i]);
      
      // Mover o mouse para fora para fechar o tooltip antes do próximo
      await page.mouse.move(0, 0);
      await expect(tooltip).not.toBeVisible();
    }
  });

  test('should show tooltips for intelligence badges', async ({ page }) => {
    // Badge ABC (Best-Seller/Popular/Normal)
    const abcBadge = page.locator('div:has-text("Inteligência de Mercado")').locator('.badge').filter({ hasText: /Best-Seller|Popular|Normal/ }).first();
    if (await abcBadge.isVisible()) {
      await abcBadge.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('Classificação ABC');
    }

    // Badge Potencial
    const potencialBadge = page.locator('text=/Potencial:/');
    if (await potencialBadge.isVisible()) {
      await potencialBadge.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('Potencial comercial');
    }
  });

  test('regression: product gallery images should NOT have tooltips', async ({ page }) => {
    const galleryImage = page.locator('.product-gallery img').first();
    if (await galleryImage.isVisible()) {
      await galleryImage.hover();
      const tooltip = page.locator('[role="tooltip"]');
      // O tooltip global tem um delay de 1000ms, mas aqui não deve aparecer nada mesmo após o tempo
      await page.waitForTimeout(1100);
      await expect(tooltip).not.toBeVisible();
      
      // Também não deve ter o atributo title nativo
      const title = await galleryImage.getAttribute('title');
      expect(title).toBeNull();
    }
  });
});
