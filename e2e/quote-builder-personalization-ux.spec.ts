import { test, expect } from '@playwright/test';

test.describe('Quote Builder - Personalization Technical UX', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a product customization state
    // We'll use the existing wizard flow or navigate directly if possible
    await page.goto('/quotes/new');
    
    // Fill minimum required for "Cliente" and "Condições" to reach "Personalização"
    // (Assuming data-testids are present from previous tasks)
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('contact-selector').click();
    await page.getByText('João Silva').first().click();
    
    // Go to Items
    await page.getByTestId('stepper-step-2').click(); // Condições
    await page.getByTestId('shipping-type-select').click();
    await page.getByText('FOB | Valor pré negociado').click();
    await page.getByPlaceholder('0,00').fill('50');
    
    // Go to Items and add a product
    await page.getByTestId('stepper-step-3').click();
    await page.getByPlaceholder('Buscar produtos...').fill('Caneta');
    await page.getByTestId('add-product-button').first().click();
    
    // Go to Personalização
    await page.getByTestId('stepper-step-4').click();
  });

  test('should handle technique change UX (focus, picker, aria-live)', async ({ page }) => {
    // 1. Select initial technique
    await page.getByText('Silk 1 cor').first().click();
    
    // 2. Open Picker via "Trocar"
    const changeBtn = page.getByTestId('customization-change-technique');
    await changeBtn.click();
    
    // 3. Verify Picker is open and focus is on first card
    await expect(page.getByTestId('customization-technique-picker')).toBeVisible();
    // In many browsers, focus moves to the button/radio inside the card
    // We check if the active element is within the picker
    const focusedHandle = await page.evaluateHandle(() => document.activeElement);
    const isInsidePicker = await page.evaluate((el) => {
      const picker = document.querySelector('[data-testid="customization-technique-picker"]');
      return picker?.contains(el);
    }, focusedHandle);
    expect(isInsidePicker).toBeTruthy();

    // 4. Select another technique
    await page.getByText('Transfer Digital').first().click();
    
    // 5. Verify Picker closes and focus returns to "Trocar"
    await expect(page.getByTestId('customization-technique-picker')).not.toBeVisible();
    await expect(changeBtn).toBeFocused();

    // 6. Verify ARIA announcement
    const announcer = page.getByTestId('customization-aria-announcer');
    await expect(announcer).toHaveTextContent(/Técnica selecionada: Transfer Digital/i);
    
    // 7. Verify Toast
    await expect(page.locator('text=Técnica alterada')).toBeVisible();
  });

  test('should persist and restore draft from sessionStorage with clamp', async ({ page }) => {
    // 1. Select technique and enter dimensions
    await page.getByText('Silk 1 cor').first().click();
    
    // Enter dimensions (assuming these IDs exist in ConfigurationPanelV6)
    await page.getByLabel(/Largura/i).fill('9');
    await page.getByLabel(/Altura/i).fill('8');
    
    // 2. Navigate away and back
    await page.getByTestId('stepper-step-1').click(); // Back to Client
    await page.getByTestId('stepper-step-4').click(); // Back to Personalization
    
    // 3. Verify restoration
    await expect(page.getByLabel(/Largura/i)).toHaveValue('9');
    await expect(page.getByLabel(/Altura/i)).toHaveValue('8');

    // 4. Change to a technique with smaller limits (forcing clamp)
    await page.getByTestId('customization-change-technique').click();
    // Assuming "Laser pequeno" has smaller limits in seeded data
    await page.getByText('Laser pequeno').first().click();
    
    // 5. Verify clamp notice and adjusted values
    await expect(page.getByTestId('clamp-notice')).toBeVisible();
    const width = await page.getByLabel(/Largura/i).inputValue();
    expect(parseFloat(width.replace(',', '.'))).toBeLessThanOrEqual(9);
  });

  test('should recalculate price and show toast on technique change', async ({ page }) => {
    await page.getByText('Silk 1 cor').first().click();
    
    // Capture initial price
    const initialPriceText = await page.getByTestId('unit-price-badge').innerText();
    
    // Rapidly change (should only trigger one toast/recalculation logically, though Playwright is slower)
    await page.getByTestId('customization-change-technique').click();
    await page.getByText('Transfer Digital').first().click();
    
    // Verify toast
    await expect(page.locator('text=Técnica alterada')).toBeVisible();
    
    // Verify price changed
    const newPriceText = await page.getByTestId('unit-price-badge').innerText();
    expect(initialPriceText).not.toBe(newPriceText);
  });
});
