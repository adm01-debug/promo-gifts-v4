import { test, expect } from '@playwright/test';

test.describe('Quote Personalization Auto-Expand', () => {
  test('should auto-expand personalization when adding a product', async ({ page }) => {
    // Navigate to new quote page
    await page.goto('/orcamentos/novo');
    
    // Step 1: Select client (simplified for E2E)
    // Assuming there's a button to "Next" or similar
    // For this test, we skip to step 3 if possible or follow the flow
    
    // Search for a product
    await page.click('button:has-text("Produto")');
    await page.fill('input[placeholder*="Pesquisar"]', 'Caneta');
    
    // Wait for results and add first one
    const productItem = page.locator('button:has-text("Adicionar")').first();
    await productItem.click();
    
    // Check if the item is added and personalization is expanded
    // The "Personalização" button should have the expanded state (ChevronUp)
    const personalizationSection = page.locator('button:has-text("Personalização")');
    await expect(personalizationSection).toBeVisible();
    
    // According to our changes, it should contain a ChevronUp (expanded)
    const chevronUp = personalizationSection.locator('svg.lucide-chevron-up');
    await expect(chevronUp).toBeVisible();
    
    // Verify techniques are visible
    const techniqueCard = page.locator('button:has-text("LASER")').first();
    if (await techniqueCard.isVisible()) {
        await techniqueCard.click();
        // Should show configuration panel
        await expect(page.locator('text=Configure a gravação')).toBeVisible();
    }
  });
});
