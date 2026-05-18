import { test, expect } from '@playwright/test';

test.describe('Quote Builder Wizard Flow (5 Steps)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new quote page
    await page.goto('/orcamentos/novo');
    // Wait for the page to load
    await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible();
  });

  test('should complete the full quote creation flow', async ({ page }) => {
    const nextButton = page.getByTestId('wizard-next-button');
    
    // 1. STEP: CLIENTE
    await expect(page.getByText('Etapa 1: Cliente (Atual)', { exact: false })).toBeVisible();
    
    // Search and Select Company
    const searchInput = page.getByPlaceholder('Buscar empresa por nome, CNPJ...');
    await searchInput.click();
    await searchInput.fill('Promo');
    
    // Wait for the specific result to be visible and click it
    // Using a more specific selector for the company item
    const companyOption = page.locator('button:has-text("Promo")').first();
    await companyOption.waitFor({ state: 'visible', timeout: 10000 });
    await companyOption.click();
    
    // Wait for contact to be loaded and auto-selected if unique, or select first
    const contactTrigger = page.getByTestId('contact-selector-trigger');
    const contactAutoSelected = page.getByText('Selecione uma empresa primeiro');
    
    // Give some time for queries
    await page.waitForTimeout(1000);
    
    if (await contactTrigger.isVisible()) {
      const triggerText = await contactTrigger.innerText();
      if (triggerText.includes('Selecione um contato')) {
        await contactTrigger.click();
        await page.locator('button[data-testid^="contact-option-"]').first().click();
      }
    }
    
    // Advance to Conditions
    await nextButton.click();

    // 2. STEP: CONDIÇÕES
    await expect(page.getByText('Etapa 2: Condições (Atual)', { exact: false })).toBeVisible();
    
    // Payment Method
    await page.getByTestId('payment-method-select-root').click();
    await page.getByRole('option', { name: 'Boleto Bancário' }).click();
    
    // Payment Terms
    await page.getByTestId('payment-terms-select-root').click();
    await page.getByRole('option', { name: '28 dias a partir da entrega' }).click();
    
    // Delivery Time
    await page.getByRole('button', { name: 'Contar dias' }).click();
    await page.getByTestId('delivery-time-select-root').click();
    await page.getByRole('option', { name: '28 dias | Após aprovação' }).click();
    
    // Shipping Type
    await page.getByTestId('shipping-type-select-root').click();
    await page.getByRole('option', { name: 'FOB | Valor pré negociado' }).click();
    
    // Shipping Cost (required for fob_pre)
    await page.getByTestId('shipping-cost-input').fill('150');
    
    // Advance to Items
    await nextButton.click();

    // 3. STEP: ÍTENS
    await expect(page.getByText('Etapa 3: Itens (Atual)', { exact: false })).toBeVisible();
    
    // Open Product Search
    await page.getByRole('button', { name: 'Adicionar Produto' }).click();
    
    // Search for a product
    const productSearchInput = page.getByPlaceholder('Buscar por nome ou SKU...');
    await productSearchInput.fill('Caneta');
    
    // Click on the first product result
    const firstProduct = page.locator('button:has-text("Caneta")').first();
    await firstProduct.waitFor({ state: 'visible' });
    await firstProduct.click();
    
    // Select color (if applicable) or just add
    const addWithoutColor = page.getByRole('button', { name: 'Adicionar sem cor específica' });
    if (await addWithoutColor.isVisible()) {
      await addWithoutColor.click();
    }
    
    // Set Quantity
    await page.getByLabel('Quantidade').first().fill('100');
    
    // Advance to Personalization
    await nextButton.click();

    // 4. STEP: PERSONALIZAÇÃO
    await expect(page.getByText('Etapa 4: Personalização (Atual)', { exact: false })).toBeVisible();
    
    // Since personalization is optional for the flow to finish, but good to test if it loads
    await expect(page.getByText('Personalização de caneta', { exact: false }).or(page.getByText('Personalização de produto', { exact: false }))).toBeVisible();
    
    // Advance to Review
    await nextButton.click();

    // 5. STEP: REVISÃO
    await expect(page.getByText('Etapa 5: Revisão (Atual)', { exact: false })).toBeVisible();
    
    // Check Summary
    await expect(page.getByText('Resumo', { exact: true })).toBeVisible();
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    
    // Final Button should be "Salvar Orçamento"
    await expect(nextButton).toHaveText('Salvar Orçamento');
  });

  test('should block jumping ahead if current step is invalid', async ({ page }) => {
    // Try to click "Itens" step directly from "Cliente"
    const itemsStep = page.getByLabel(/Etapa 3: Itens/);
    await itemsStep.click();
    
    // Should show error and stay on Step 1
    await expect(page.getByText('Selecione um cliente')).toBeVisible();
    await expect(page.getByText('Etapa 1: Cliente (Atual)', { exact: false })).toBeVisible();
  });

  test('should show accessibility announcements on validation failure', async ({ page }) => {
    const nextButton = page.getByTestId('wizard-next-button');
    await nextButton.click();
    
    const announcer = page.locator('#quote-builder-announcer');
    await expect(announcer).toHaveText('Erro: Selecione um cliente');
  });
});
