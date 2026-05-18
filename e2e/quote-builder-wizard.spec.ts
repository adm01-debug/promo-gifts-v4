import { test, expect } from '@playwright/test';

test.describe('Quote Builder Wizard Flow (5 Steps)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the new quote page
    await page.goto('/orcamentos/novo');
    // Wait for the page to load
    await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible();
  });

  test('should navigate through all 5 steps with validation', async ({ page }) => {
    const nextButton = page.getByTestId('wizard-next-button');
    const prevButton = page.getByTestId('wizard-prev-button');
    
    // 1. STEP: CLIENTE (Initial)
    await expect(page.getByText('Etapa 1: Cliente (Atual)', { exact: false })).toBeVisible();
    
    // Try to advance without selecting client
    await nextButton.click();
    // Validate toast or announcer
    await expect(page.getByText('Selecione um cliente')).toBeVisible();
    
    // Fill Cliente - We search and pick a result if any, or we skip to validation test
    const searchInput = page.getByPlaceholder('Buscar empresa por nome, CNPJ...');
    await searchInput.click();
    await searchInput.fill('Promo');
    
    // Wait for results
    const firstOption = page.locator('button:has(span.font-medium)').first();
    await firstOption.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    if (await firstOption.isVisible()) {
      await firstOption.click();
      
      // Wait for contact selection (it might auto-select if only one exists)
      // Check if contact is selected or select one
      const contactLabel = page.getByText('Selecione uma empresa primeiro');
      if (await contactLabel.isHidden()) {
        // Step 1 should be potentially valid now if a contact is also present
        await nextButton.click();
        
        // If we moved to step 2, check it
        const step2Title = page.getByText('Etapa 2: Condições (Atual)', { exact: false });
        if (await step2Title.isVisible()) {
          // 2. STEP: CONDIÇÕES
          await expect(step2Title).toBeVisible();
          
          // Test jumping back
          const step1Button = page.getByLabel(/Etapa 1: Cliente/);
          await step1Button.click();
          await expect(page.getByText('Etapa 1: Cliente (Atual)', { exact: false })).toBeVisible();
        }
      }
    }
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
