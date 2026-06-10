import { test, expect } from '@playwright/test';

test.describe('Catalog Sort Bug Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the products page
    await page.goto('/produtos');
    // Wait for initial load
    await page.waitForSelector('[data-testid="page-title-produtos"]');
  });

  test('should allow changing sort and preserve it in the URL', async ({ page }) => {
    const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
    await expect(sortTrigger).toBeVisible();

    // 1. Change to "Preço (Menor → Maior)" (price-asc)
    await sortTrigger.click();
    const priceAscOption = page.locator('[data-testid="catalog-sort-item-price-asc"]');
    await priceAscOption.click();

    // 2. Verify URL contains sort=price-asc
    await expect(page).toHaveURL(/sort=price-asc/);

    // 3. Verify the URL is maintained after reload
    await page.reload();
    await page.waitForSelector('[data-testid="page-title-produtos"]');
    await expect(page).toHaveURL(/sort=price-asc/);
    
    // 4. Verify sort trigger displays the correct selection after reload
    await expect(page.locator('[data-testid="catalog-sort-trigger"]')).toContainText(/Preço/i);
    
    // 5. Change back to "Mais Recentes" (newest) which we know triggers removal in URL
    await sortTrigger.click();
    const newestOption = page.locator('[data-testid="catalog-sort-item-newest"]');
    await newestOption.click();
    
    const url = new URL(page.url());
    expect(url.searchParams.has('sort')).toBe(false);
  });

  test('should maintain sort when searching', async ({ page }) => {
    // 1. Set sort to price-desc
    const sortTrigger = page.locator('[data-testid="catalog-sort-trigger"]');
    await sortTrigger.click();
    await page.locator('[data-testid="catalog-sort-item-price-desc"]').click();
    await expect(page).toHaveURL(/sort=price-desc/);

    // 2. Perform a search using the desktop search input
    const searchInput = page.locator('#search-desktop');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('caneta');
    await searchInput.press('Enter');
    
    // 3. Wait for search to be reflected in URL (assuming it goes to /produtos?search=caneta&sort=price-desc)
    await page.waitForURL(/search=caneta/);
    
    // 4. Verify both search and sort are in URL
    const url = new URL(page.url());
    expect(url.searchParams.get('sort')).toBe('price-desc');
    expect(url.searchParams.get('search')).toBe('caneta');
  });

  test('should allow changing layouts and column count', async ({ page }) => {
    const layoutTrigger = page.locator('[data-testid="layout-popover-trigger"]');
    await expect(layoutTrigger).toBeVisible();
    
    // 1. Open layout popover
    await layoutTrigger.click();
    
    // 2. Switch to List view
    const listBtn = page.getByRole('button', { name: /Lista/i });
    await listBtn.click();
    
    // 3. Check if list view is rendered (catalog-list-skeleton or ProductList component)
    // We can check if a certain element specific to list view exists
    await expect(page.locator('.flex-col.gap-4')).toBeVisible(); // Common list container pattern
    
    // 4. Open popover again and change columns (back to grid first)
    await layoutTrigger.click();
    await page.getByRole('button', { name: /Grid/i }).click();
    
    // 5. Change columns to 3
    const col3Btn = page.locator('[data-testid="column-option-3"]');
    if (await col3Btn.isVisible()) {
      await col3Btn.click();
      // Verify local storage or visual change if possible
    }
  });

  test('should handle invalid sort params by reverting to default', async ({ page }) => {
    // 1. Navigate with invalid sort
    await page.goto('/produtos?sort=invalid-option');
    await page.waitForSelector('[data-testid="page-title-produtos"]');
    
    // 2. Verify URL is normalized (param removed or changed to newest)
    // useCatalogState logic will remove 'sort' if it normalizes to 'newest'
    const url = new URL(page.url());
    const sort = url.searchParams.get('sort');
    expect(sort === null || sort === 'newest').toBe(true);
  });
});

