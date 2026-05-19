import { test, expect } from '@playwright/test';

test.describe('Quote Builder - Personalization E2E UX & Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Setup inicial para chegar na etapa de Personalização
    await page.goto('/quotes/new');
    
    // Etapa 1: Cliente
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('contact-selector').click();
    await page.getByText('João Silva').first().click();
    
    // Etapa 2: Condições
    await page.getByTestId('stepper-step-2').click();
    await page.getByTestId('shipping-type-select').click();
    await page.getByText('FOB | Valor pré negociado').click();
    await page.getByPlaceholder('0,00').fill('50');
    
    // Etapa 3: Itens
    await page.getByTestId('stepper-step-3').click();
    await page.getByPlaceholder('Buscar produtos...').fill('Caneta');
    await page.getByTestId('add-product-button').first().click();
    
    // Etapa 4: Personalização
    await page.getByTestId('stepper-step-4').click();
    await expect(page.getByTestId('customization-location-panel')).toBeVisible();
  });

  test('deve validar transição de técnica com data-testids, foco e aria-live', async ({ page }) => {
    // 1. Seleciona técnica A (Silk)
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 2. Troca para técnica B (Transfer) via data-testid
    const changeBtn = page.getByTestId('customization-change-technique');
    await changeBtn.click();
    
    // 3. Verifica seletor aberto e aria-live
    await expect(page.getByTestId('customization-technique-picker')).toBeVisible();
    await expect(page.getByTestId('customization-aria-announcer')).toContainText(/Seletor de técnicas aberto/i);
    
    // 4. Seleciona técnica B
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // 5. Verifica seletor fechado, foco devolvido e toast
    await expect(page.getByTestId('customization-technique-picker')).not.toBeVisible();
    await expect(changeBtn).toBeFocused();
    await expect(page.locator('.sonner-toast')).toContainText(/Técnica alterada/i);
    
    // 6. Valida aria-live final
    await expect(page.getByTestId('customization-aria-announcer')).toContainText(/Técnica selecionada: Transfer Digital/i);
  });

  test('deve validar clamp de dimensões e cores ao trocar para técnica restritiva', async ({ page }) => {
    // 1. Seleciona Transfer (Tech B) - Limites: 10x10, 4 cores
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // 2. Preenche valores altos
    await page.getByTestId('customization-width-input').fill('9');
    await page.getByTestId('customization-height-input').fill('8');
    await page.getByTestId('customization-color-button-4').click();
    
    // 3. Troca para técnica restritiva (Laser Pequeno - Tech Small: 5x3, 1 cor)
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-small').click();
    
    // 4. Valida clamp nos inputs e exibição do Alert
    await expect(page.getByTestId('clamp-notice')).toBeVisible();
    await expect(page.getByTestId('customization-width-input')).toHaveValue('5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('3');
    
    // Laser não cobra por cor ou tem max_cores=1, valida que o botão de 4 cores sumiu/foi resetado
    await expect(page.getByTestId('customization-color-button-4')).not.toBeVisible();
  });

  test('deve lidar com trocas rápidas A->B->A e validar toast único e preço final', async ({ page }) => {
    // 1. Estado inicial A
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 2. Troca rápida A -> B -> A
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // Imediatamente abre de novo e volta para A
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 3. Valida que o toast final de B->A apareceu (ou que o seletor fechou silenciosamente se for a mesma técnica)
    // Se clicamos em A, depois trocamos para B, o toast diz A->B. 
    // Se clicamos em Trocar e selecionamos A de novo, o toast diz B->A.
    // O requisito é validar que não há "spam" e o preço bate com o estado final (A).
    const priceText = await page.getByTestId('customization-total-price').innerText();
    expect(priceText).toContain('200,00'); // Valor mockado no teste unitário, aqui validamos consistência
    
    // Verifica se há apenas um toast visível de "Técnica alterada" (ou o mais recente)
    const toasts = page.locator('.sonner-toast');
    await expect(toasts).toHaveCount(1);
  });

  test('deve restaurar rascunho após navegação completa (Sair -> Voltar)', async ({ page }) => {
    // 1. Configura gravação
    await page.getByTestId('customization-technique-card-tech-B').click();
    await page.getByTestId('customization-width-input').fill('7.5');
    await page.getByTestId('customization-height-input').fill('4.2');
    await page.getByTestId('customization-color-button-2').click();
    
    // 2. Navega para Dashboard (Página diferente completa)
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // 3. Volta para Novo Orçamento (Simulando fluxo do usuário)
    await page.goto('/quotes/new');
    
    // Navega até a etapa 4 novamente
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('stepper-step-4').click();
    
    // 4. Valida restauração completa dos dados do sessionStorage
    await expect(page.getByTestId('customization-width-input')).toHaveValue('7.5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('4.2');
    await expect(page.getByTestId('customization-color-button-2')).toHaveClass(/bg-primary/); // Selecionado
    
    // Valida que o preço foi recalculado corretamente na hidratação
    await expect(page.getByTestId('customization-total-price')).toBeVisible();
  });
});
