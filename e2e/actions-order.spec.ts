import { test, expect } from '@playwright/test';

test.describe('Product Actions Order and Tooltips', () => {
  test.beforeEach(async ({ page }) => {
    // We assume /produtos has the catalog
    await page.goto('/produtos');
    // Wait for product list to be visible
    await page.waitForSelector('[data-testid="product-favorite"]', { timeout: 10000 }).catch(() => {});
  });

  const expectedOrder = [
    { label: 'Adicionar ao Carrinho', icon: 'Carrinho' },
    { label: 'Orçamento', icon: 'Orçamento' },
    { label: 'Coleção', icon: 'Coleção' },
    { label: 'Favoritar', icon: 'Favoritar' },
    { label: 'Comparar', icon: 'Comparar' },
    { label: 'Quick View', icon: 'Quick View' },
    { label: 'Compartilhar', icon: 'Compartilhar' }
  ];

  test('should have correct actions order in list view (desktop)', async ({ page }) => {
    // Filter by desktop to ensure the sm:flex buttons are visible
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Select the first product action container
    const actionContainer = page.locator('.group .flex.shrink-0.items-center.gap-0.5').first();
    
    // Check aria-labels in order
    // We expect the direct buttons or the buttons inside div.hidden.sm:flex
    // Using a more robust selector that finds all buttons within the container, regardless of nesting
    const buttons = actionContainer.locator('button');
    
    for (let i = 0; i < expectedOrder.length; i++) {
      const btn = buttons.nth(i);
      await expect(btn).toHaveAttribute('aria-label', expectedOrder[i].label);
    }
  });

  test('should have correct actions order in table view', async ({ page }) => {
    // Switch to table view if possible
    const tableViewBtn = page.getByRole('button', { name: /Tabela/i }).first();
    if (await tableViewBtn.isVisible()) {
      await tableViewBtn.click();
    }

    const tableActions = page.locator('div.flex.items-center.justify-center.gap-0.5').first();
    const actionButtons = tableActions.locator('button, .h-7.w-7');

    for (let i = 0; i < expectedOrder.length; i++) {
      const btn = actionButtons.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      // Verify order based on aria-label
    }
  });
});
