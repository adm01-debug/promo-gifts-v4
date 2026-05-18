import { test, expect } from '@playwright/test';

test.describe('Quote Builder - Shipping & Persistence Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new quote page
    await page.goto('/orcamentos/novo');
    await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible();
  });

  test('should block wizard progression if shipping is not selected', async ({ page }) => {
    // 1. STEP: CLIENTE
    // Fill client info first to get to step 2
    const searchInput = page.getByPlaceholder('Buscar empresa por nome, CNPJ...');
    await searchInput.fill('Promo');
    const companyOption = page.locator('button:has-text("Promo")').first();
    await companyOption.waitFor({ state: 'visible' });
    await companyOption.click();
    
    // Select contact if needed
    const contactTrigger = page.getByTestId('contact-selector-trigger');
    await page.waitForTimeout(1000);
    if (await contactTrigger.isVisible()) {
      const triggerText = await contactTrigger.innerText();
      if (triggerText.includes('Selecione um contato')) {
        await contactTrigger.click();
        await page.locator('button[data-testid^="contact-option-"]').first().click();
      }
    }

    const nextButton = page.getByTestId('wizard-next-button');
    await nextButton.click();

    // 2. STEP: CONDIÇÕES
    await expect(page.getByText('Etapa 2: Condições (Atual)', { exact: false })).toBeVisible();

    // Fill other required fields but leave shipping empty
    await page.getByTestId('payment-method-select-root').click();
    await page.getByRole('option', { name: 'Boleto Bancário' }).click();
    
    await page.getByTestId('payment-terms-select-root').click();
    await page.getByRole('option', { name: '7 dias a partir da entrega' }).click();
    
    await page.getByRole('button', { name: 'Contar dias' }).click();
    await page.getByTestId('delivery-time-select-root').click();
    await page.getByRole('option', { name: '7 dias | Após aprovação' }).click();

    // Try to advance without selecting shipping
    await nextButton.click();

    // Should show inline error message
    await expect(page.getByText('Selecione a modalidade de frete')).toBeVisible();
    // Should show toast error (state logic)
    await expect(page.locator('ol[dir="ltr"]')).toContainText('Selecione a modalidade de frete');
    // Should stay on conditions step
    await expect(page.getByText('Etapa 2: Condições (Atual)', { exact: false })).toBeVisible();
  });

  test('should persist shipping selection after page reload (AutoSave)', async ({ page }) => {
    // 1. Setup minimal state for AutoSave (needs clientId and items)
    // Client
    const searchInput = page.getByPlaceholder('Buscar empresa por nome, CNPJ...');
    await searchInput.fill('Promo');
    await page.locator('button:has-text("Promo")').first().click();
    await page.waitForTimeout(500);

    // Add an item (AutoSave usually triggers when client + items exist)
    await page.getByTestId('wizard-next-button').click(); // to step 2
    await page.getByTestId('wizard-next-button').click(); // try step 3 (will fail if conditions empty, but let's go to step 3 properly)
    
    // Fill step 2 to reach step 3
    await page.getByTestId('payment-method-select-root').click();
    await page.getByRole('option', { name: 'Boleto Bancário' }).click();
    await page.getByTestId('payment-terms-select-root').click();
    await page.getByRole('option', { name: '7 dias a partir da entrega' }).click();
    await page.getByRole('button', { name: 'Contar dias' }).click();
    await page.getByTestId('delivery-time-select-root').click();
    await page.getByRole('option', { name: '7 dias | Após aprovação' }).click();
    
    // Select Shipping
    await page.getByTestId('shipping-type-select-root').click();
    await page.getByRole('option', { name: 'FOB | Repassado ao cliente' }).click();
    await expect(page.locator('ol[dir="ltr"]')).toContainText('Frete alterado para: FOB');

    // Go to step 3 and add item
    await page.getByTestId('wizard-next-button').click();
    await page.getByRole('button', { name: 'Adicionar Produto' }).click();
    await page.getByPlaceholder('Buscar por nome ou SKU...').fill('Caneta');
    await page.locator('button:has-text("Caneta")').first().click();
    const addWithoutColor = page.getByRole('button', { name: 'Adicionar sem cor específica' });
    if (await addWithoutColor.isVisible()) await addWithoutColor.click();
    
    // Wait for AutoSave (usually 2s debounce)
    await page.waitForTimeout(3000);

    // 2. Reload page
    await page.reload();
    await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible();

    // 3. Verify restoration
    // Go to step 2 to check shipping
    await page.getByTestId('step-indicator-conditions').click();
    
    // Check if "FOB | Repassado ao cliente" is selected
    const shippingTrigger = page.getByTestId('shipping-type-select');
    await expect(shippingTrigger).toContainText('FOB | Repassado ao cliente');
  });

  test('should handle FOB pre-negotiated value validation and persistence', async ({ page }) => {
    // 1. STEP: CLIENTE
    await page.getByPlaceholder('Buscar empresa por nome, CNPJ...').fill('Promo');
    await page.locator('button:has-text("Promo")').first().click();
    await page.getByTestId('wizard-next-button').click();

    // 2. STEP: CONDIÇÕES
    // Select FOB Pre-negotiated
    await page.getByTestId('shipping-type-select-root').click();
    await page.getByRole('option', { name: 'FOB | Valor pré negociado' }).click();

    // Verify input appears
    const costInput = page.getByTestId('shipping-cost-input');
    await expect(costInput).toBeVisible();

    // Try to advance without filling cost
    await page.getByTestId('wizard-next-button').click();
    await expect(page.getByText('Informe o valor do frete pré-negociado')).toBeVisible();

    // Fill cost
    await costInput.fill('250,50');
    
    // Add item to enable AutoSave
    await page.getByTestId('payment-method-select-root').click();
    await page.getByRole('option', { name: 'Boleto Bancário' }).click();
    await page.getByTestId('payment-terms-select-root').click();
    await page.getByRole('option', { name: '7 dias a partir da entrega' }).click();
    await page.getByRole('button', { name: 'Contar dias' }).click();
    await page.getByTestId('delivery-time-select-root').click();
    await page.getByRole('option', { name: '7 dias | Após aprovação' }).click();
    
    await page.getByTestId('wizard-next-button').click();
    await page.getByRole('button', { name: 'Adicionar Produto' }).click();
    await page.getByPlaceholder('Buscar por nome ou SKU...').fill('Caneta');
    await page.locator('button:has-text("Caneta")').first().click();
    const addWithoutColor = page.getByRole('button', { name: 'Adicionar sem cor específica' });
    if (await addWithoutColor.isVisible()) await addWithoutColor.click();

    // Wait for AutoSave
    await page.waitForTimeout(3000);

    // Reload
    await page.reload();
    
    // Navigate back to step 2
    await page.getByTestId('step-indicator-conditions').click();

    // Verify selection and value
    await expect(page.getByTestId('shipping-type-select')).toContainText('FOB | Valor pré negociado');
    await expect(page.getByTestId('shipping-cost-input')).toHaveValue('250,50');
  });
});
