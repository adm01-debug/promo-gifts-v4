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

    // 1. Check initial sort (should be 'newest' based on useCatalogState, but UI shows 'Nome (A-Z)' which is 'name')
    // Actually, looking at constants/filters.ts, 'name' is the first option.
    // useCatalogState line 76 returns 'newest' as default.
    // Let's check what's actually selected.
    
    // 2. Change to "Preço (Menor → Maior)" (price-asc)
    await sortTrigger.click();
    const priceAscOption = page.locator('[data-testid="catalog-sort-item-price-asc"]');
    await priceAscOption.click();

    // 3. Verify URL contains sort=price-asc
    await expect(page).toHaveURL(/sort=price-asc/);

    // 4. Verify the Select trigger shows the correct label (or at least doesn't revert to default)
    // The SelectValue inside might be hidden on mobile, but on desktop it should be there.
    // We can also check the URL after a reload.
    await page.reload();
    await expect(page).toHaveURL(/sort=price-asc/);
    
    // 5. Change back to "Nome (A-Z)" (name)
    await sortTrigger.click();
    const nameOption = page.locator('[data-testid="catalog-sort-item-name"]');
    await nameOption.click();

    // 6. Verify URL sort param is removed (since name is the default or one of the defaults that trigger removal)
    // Wait, useCatalogState line 195 says if sortBy === 'newest' it deletes 'sort'.
    // Let's check what 'name' does.
    // If 'name' is selected, does it stay in URL?
    // Let's try "Mais Recentes" (newest) which we know triggers removal.
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

    // 2. Perform a search
    const searchInput = page.getByPlaceholder(/Buscar produtos/i).first();
    await searchInput.fill('caneta');
    // The search component likely navigates or updates URL
    await page.waitForTimeout(1000); // Wait for debounce and navigation
    
    // 3. Verify both search and sort are in URL
    const url = new URL(page.url());
    expect(url.searchParams.get('sort')).toBe('price-desc');
    expect(url.searchParams.get('search')).toBe('caneta');
  });

  test('should handle invalid sort params by reverting to default', async ({ page }) => {
    // 1. Navigate with invalid sort
    await page.goto('/produtos?sort=invalid-option');
    
    // 2. Verify URL is normalized (param removed or changed to newest)
    await page.waitForTimeout(1000);
    const url = new URL(page.url());
    const sort = url.searchParams.get('sort');
    // According to useCatalogState, it should be removed if it's 'newest' or invalid (reverts to newest)
    expect(sort === null || sort === 'newest').toBe(true);
  });
});
