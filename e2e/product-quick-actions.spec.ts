import { test, expect } from '@playwright/test';

test.describe('ProductQuickActions Tooltips E2E', () => {
  test('should show and hide tooltips on hover for quick action buttons', async ({ page }) => {
    // Navigate to a product page that has these actions
    // Using a common path pattern, adjust if there's a specific test product
    await page.goto('/produto/mock-product-id'); 
    
    // Wait for the buttons to be visible
    const quickActionsContainer = page.locator('div.flex.w-full.flex-col.gap-3.pt-2');
    await expect(quickActionsContainer).toBeVisible();

    const actions = [
      { label: 'Preços', description: 'Veja a tabela completa de preços por quantidade e variações' },
      { label: 'Gravação', description: 'Confira técnicas de gravação, áreas e cores disponíveis' },
      { label: 'Indicação', description: 'Veja para qual público, datas e ocasiões este produto é indicado' },
      { label: 'Nicho', description: 'Descubra os nichos e segmentos onde este produto se encaixa' },
    ];

    for (const action of actions) {
      const button = page.getByRole('button', { name: action.label, exact: true });
      
      // Hover over the button
      await button.hover();
      
      // Check if tooltip content is visible
      const tooltip = page.getByText(action.description);
      await expect(tooltip).toBeVisible();
      
      // Move mouse away
      await page.mouse.move(0, 0);
      
      // Check if tooltip is hidden
      await expect(tooltip).not.toBeVisible();
    }
  });

  test('should not have native title attributes on quick action buttons', async ({ page }) => {
    await page.goto('/produto/mock-product-id');
    
    const buttons = page.locator('div.flex.w-full.flex-col.gap-3.pt-2 button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const title = await buttons.nth(i).getAttribute('title');
      expect(title).toBeNull();
    }
  });
});
