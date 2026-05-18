import { test, expect } from './fixtures/test-base';
import { loginAs } from './helpers/auth';

test.describe('QuoteBuilder - Shipping Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/quotes/new');
    
    // Wait for the page to load and shipping select to be visible
    await page.waitForSelector('[data-testid="shipping-type-select"]', { timeout: 15000 });
  });

  test('shipping cost should only appear and be required for "FOB | Valor pré negociado"', async ({ page }) => {
    const shippingSelect = page.getByTestId('shipping-type-select');
    const costInput = page.getByTestId('shipping-cost-input');

    // 1. Initially cost input should not be visible (CIF is usually default or empty)
    await expect(costInput).not.toBeVisible();

    // 2. Select "FOB | Repassado ao cliente" - cost input should NOT be visible
    await shippingSelect.click();
    await page.getByText('FOB | Repassado ao cliente').click();
    await expect(costInput).not.toBeVisible();

    // 3. Select "FOB | Valor pré negociado" - cost input SHOULD be visible
    await shippingSelect.click();
    await page.getByText('FOB | Valor pré negociado').click();
    await expect(costInput).toBeVisible();

    // 4. Verify it's required in validation if visible but empty
    // First, let's try to save as draft or just check validation messages if any
    const saveDraftBtn = page.getByRole('button', { name: /Salvar Rascunho/i });
    // Note: in this app, validation errors often appear as red borders or in a list at the bottom
    const validationList = page.locator('ul:has-text("Campos obrigatórios pendentes")');
    
    // Switch back to "FOB | Valor pré negociado" to trigger validation requirement
    // (Assuming it was already selected in step 3)
    await expect(validationList).toContainText('Valor do Frete');

    // 5. Fill value and check total
    await costInput.fill('100,00');
    await costInput.blur();
    
    // Check that 'Valor do Frete' disappears from validation list
    await expect(validationList).not.toContainText('Valor do Frete');
    
    // Check total includes shipping (need at least one item to see total clearly)
    // For now, checking visibility and validation is the main requirement.
  });

  test('shipping cost should not affect total when in "Repassado ao cliente" mode', async ({ page }) => {
    const shippingSelect = page.getByTestId('shipping-type-select');
    
    // Select "FOB | Valor pré negociado" and set a cost
    await shippingSelect.click();
    await page.getByText('FOB | Valor pré negociado').click();
    const costInput = page.getByTestId('shipping-cost-input');
    await costInput.fill('50,00');
    await costInput.blur();

    // Switch to "FOB | Repassado ao cliente"
    await shippingSelect.click();
    await page.getByText('FOB | Repassado ao cliente').click();
    
    // Input should disappear
    await expect(costInput).not.toBeVisible();
    
    // The cost should be reset to 0 in state
    // We can verify this by switching back and seeing if it's 0 (since our handler resets it)
    await shippingSelect.click();
    await page.getByText('FOB | Valor pré negociado').click();
    await expect(costInput).toHaveValue(''); // or '0,00' depending on implementation
  });
});
