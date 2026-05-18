import { test, expect } from '@playwright/test';

test.describe('Fluxo de Personalização de Produto', () => {
  test('deve completar o fluxo Local -> Técnica -> Tamanho com sucesso', async ({ page }) => {
    // Nota: Este teste assume um ambiente com dados de exemplo.
    // Em um cenário real, navegaríamos até o orçador primeiro.
    await page.goto('/quote/new');
    
    // 1. Selecionar um local
    const firstLocation = page.locator('button:has-text("LADO A")').first();
    await expect(firstLocation).toBeVisible();
    await firstLocation.click();

    // 2. Selecionar uma técnica
    const firstTechnique = page.locator('button:has-text("SILK")').first();
    await expect(firstTechnique).toBeVisible();
    await firstTechnique.click();

    // 3. Validar que o painel de configuração apareceu
    await expect(page.locator('text=Dimensões e Cores')).toBeVisible();
    
    // 4. Confirmar gravação
    const confirmBtn = page.locator('button:has-text("Confirmar Gravação")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 5. Validar estado de sucesso
    await expect(page.locator('text=No Orçamento')).toBeVisible();
  });

  test('deve respeitar a exclusividade entre Circular e Lado A/B', async ({ page }) => {
    await page.goto('/quote/new');
    
    // Selecionar Lado A
    await page.locator('button:has-text("LADO A")').first().click();
    await page.locator('button:has-text("SILK")').first().click();
    await page.locator('button:has-text("Confirmar Gravação")').click();

    // Tentar selecionar Circular (deve estar desabilitado)
    const circularBtn = page.locator('button:has-text("CIRCULAR")').first();
    await expect(circularBtn).toBeDisabled();
  });
});
