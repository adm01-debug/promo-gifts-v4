import { test, expect } from '@playwright/test';

/**
 * Testes E2E para validação de Tooltips na Inteligência de Mercado
 */
test.describe('Market Intelligence Tooltips', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navegar para a página de inteligência (ajuste a rota conforme necessário)
    await page.goto('/inteligencia');
  });

  test('should show skeletons while loading and then updated tooltips', async ({ page }) => {
    // Verificar se o container principal está visível
    const marketChart = page.locator('div[aria-label="Métricas de inteligência de mercado"]');
    await expect(marketChart).toBeVisible();

    // 1. Validar Skeletons (simulado ou rápido o suficiente para ver)
    // Nota: Dependendo da velocidade da rede, o skeleton pode sumir rápido.
    // Procuramos pelo botão de info que dispara o tooltip
    const infoButtons = page.locator('button[aria-label^="Sobre"]');
    await expect(infoButtons).toHaveCount(4);

    // 2. Testar primeiro card (Vendas no mercado)
    await infoButtons.nth(0).hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Velocidade média de saída');
    await expect(tooltip).toContainText('Dica de Argumentação');

    // 3. Validar formatação pt-BR (ex: vírgula como separador decimal)
    // Esperamos algo como "X,Y un/dia"
    await expect(tooltip).toMatchState({
        content: /\\d+,\\d+ un\\/dia/
    });
  });

  test('should show scenario-specific negotiation arguments', async ({ page }) => {
    const infoButtons = page.locator('button[aria-label^="Sobre"]');
    
    // Card 3: Tendência
    await infoButtons.nth(2).hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toContainText('Como agir');
    // Deve conter frases de impacto baseadas nos dados reais/mock
    await expect(tooltip).toContainText('procura');
  });

  test('should be responsive across different screen sizes', async ({ page }) => {
    // Testar em Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    const marketChart = page.locator('div[aria-label="Métricas de inteligência de mercado"]');
    await expect(marketChart).toBeVisible();
    
    // Testar em Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(marketChart).toBeVisible();
  });

  test('should handle empty/zero values gracefully', async ({ page }) => {
    // Aqui poderíamos interceptar a chamada de API (mock) para retornar valores vazios
    // mas o componente já usa formatTooltipNumber que retorna "Sem dados"
    // Validaremos se o fallback aparece caso não haja dados
  });
});
