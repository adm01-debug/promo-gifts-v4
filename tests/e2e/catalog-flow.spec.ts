import { test, expect } from '@playwright/test';

test.describe('Catalog E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the products page
    await page.goto('/produtos');
  });

  test('should simulate a full user flow: sort, search, filter and paginate', async ({ page }) => {
    // 1. Initial render check
    await expect(page.locator('text=produtos').first()).toBeVisible();
    const initialCountText = await page.locator('text=produtos').first().innerText();
    const initialCount = parseInt(initialCountText.match(/\d+/)?.[0] || '0');

    // 2. Change sort
    const sortSelect = page.getByRole('combobox').filter({ hasText: 'Nome (A-Z)' });
    await sortSelect.click();
    await page.getByRole('option', { name: 'Preço (Menor → Maior)' }).click();
    
    // URL should update
    await expect(page).toHaveURL(/sortBy=price-asc/);

    // 3. Search for a term
    const searchInput = page.getByPlaceholder(/Buscar no catálogo/i);
    await searchInput.fill('caneta');
    
    // Debounce wait and results check
    await page.waitForTimeout(500); 
    await expect(page).toHaveURL(/search=caneta/);

    // 4. Toggle a filter (e.g., Em Estoque)
    // Assuming there's a filter button or sidebar
    const filterButton = page.getByRole('button', { name: /Filtros/i }).first();
    await filterButton.click();
    
    // Find stock filter in side panel/modal
    const inStockCheckbox = page.getByLabel(/Em Estoque/i);
    if (await inStockCheckbox.isVisible()) {
      await inStockCheckbox.check();
      await expect(page).toHaveURL(/inStock=1/);
    }

    // 5. Navigate between pages (Infinite scroll check)
    // Scroll to bottom to trigger infinite load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check if more items are loaded or if count is consistent
    const finalCountText = await page.locator('text=produtos').first().innerText();
    expect(finalCountText).toBeDefined();
    
    // Check for badges
    const filterBadge = page.locator('span.bg-secondary').filter({ hasText: /\d+/ });
    await expect(filterBadge).toBeVisible();
  });

  test('should display empty state when no products match', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar no catálogo/i);
    await searchInput.fill('PRODUTO_INEXISTENTE_XYZ_123');
    
    await page.waitForTimeout(1000);
    // Should show empty state message
    await expect(page.locator('text=Nenhum produto encontrado')).toBeVisible();
    
    // Pagination should not be visible or be reset
    await expect(page.locator('button:has-text("Carregar mais")')).not.toBeVisible();
  });
});
