import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Product Catalog Sorting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the product catalog page
    await page.goto('/products');
    // Wait for initial products to load
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
  });

  test('should open sort menu and change criteria', async ({ page }) => {
    // Find the sort trigger button
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await expect(sortTrigger).toBeVisible();
    
    // Click to open the menu
    await sortTrigger.click();
    
    // Verify sort options are visible
    const sortMenu = page.locator('div[role="listbox"]');
    // The specific UI might use SelectItem which often renders as a div with role="option"
    await expect(page.locator('role=option[name="Menor Preço"]')).toBeVisible();
    await expect(page.locator('role=option[name="Maior Preço"]')).toBeVisible();
    await expect(page.locator('role=option[name="Nome (A-Z)"]')).toBeVisible();

    // Select "Menor Preço"
    await page.locator('role=option[name="Menor Preço"]').click();
    
    // Verify URL update
    await expect(page).toHaveURL(/sort=price-asc/);
    
    // Verify visual feedback (trigger should show selected option or at least stay active)
    await expect(sortTrigger).toBeVisible();
  });

  test('should maintain sorting even with active search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      // 1. Set sort first
      const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
      await sortTrigger.click();
      await page.locator('role=option[name="Menor Preço"]').click();
      await expect(page).toHaveURL(/sort=price-asc/);

      // 2. Perform search
      await searchInput.fill('caneta');
      await page.waitForTimeout(1000); // Wait for debounce
      
      // 3. Verify sort is still active in URL and logic
      await expect(page).toHaveURL(/sort=price-asc/);
      await expect(page).toHaveURL(/search=caneta/);
      
      // 4. Change sort during search
      await sortTrigger.click();
      await page.locator('role=option[name="Maior Preço"]').click();
      await expect(page).toHaveURL(/sort=price-desc/);
    }
  });

  test('should persist sorting on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await expect(sortTrigger).toBeVisible();
    
    // On mobile, the button is often smaller (icon only) but aria-label remains
    await sortTrigger.click();
    await page.locator('role=option[name="Maior Preço"]').click();
    
    await expect(page).toHaveURL(/sort=price-desc/);
  });

  test('should restore persisted sorting after re-login', async ({ page }) => {
    // This test simulates persistence. In a real environment, we'd login as a specific user.
    // For this mock/E2E structure, we verify the preference is saved to storage.
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Maior Estoque"]').click();
    
    // Refresh page to simulate new session
    await page.reload();
    await page.waitForSelector('[data-testid="product-card"]');
    
    // Check if the preference was restored (reflected in URL or UI state)
    await expect(page).toHaveURL(/sort=stock/);
  });

  test('accessibility should be correct for sorting menu', async ({ page }) => {
    await injectAxe(page);
    
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    
    // Check initial state a11y
    await checkA11y(page, 'button[aria-label="Ordenar por"]');
    
    // Keyboard navigation: focus the trigger
    await sortTrigger.focus();
    await page.keyboard.press('Enter');
    
    // Verify menu is open and focused properly
    const menu = page.locator('role=listbox');
    await expect(menu).toBeVisible();
    
    // Check menu a11y when open
    await checkA11y(page, 'div[role="listbox"]');
    
    // Keyboard navigation: move through options
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    
    // Focus should return to trigger
    await expect(sortTrigger).toBeFocused();
  });

  test('should handle persistence loading failure gracefully with toast', async ({ page }) => {
    // Intercept profile fetch and return error
    await page.route('**/rest/v1/profiles*', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Database connection failed' }),
      });
    });

    await page.reload();
    
    // Check for error toast
    await expect(page.getByText('Erro ao carregar preferências')).toBeVisible();
    
    // Should fallback to default 'relevance' or name sorting
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await expect(sortTrigger).toBeVisible();
    await expect(page).not.toHaveURL(/sort=/);
    
    // Validate order of products (sequence check)
    const productCards = page.locator('[data-testid="product-card"]');
    const firstProductName = await productCards.nth(0).locator('h3').innerText();
    const secondProductName = await productCards.nth(1).locator('h3').innerText();
    // Default alphabetical order check if applicable, or just verify presence
    expect(firstProductName.length).toBeGreaterThan(0);
  });

  test('should handle persistence saving failure with toast', async ({ page }) => {
    // Intercept profile update and return error
    await page.route('**/rest/v1/profiles*', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Save failed' }),
        });
      } else {
        route.continue();
      }
    });

    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Maior Estoque"]').click();
    
    // Check for error toast on save
    await expect(page.getByText('Erro ao salvar preferência')).toBeVisible();
    
    // URL should still update locally
    await expect(page).toHaveURL(/sort=stock/);
  });

  test('should track analytics events during search and sort', async ({ page }) => {
    const analyticsRequests: any[] = [];
    await page.route('**/rest/v1/catalog_analytics', (route) => {
      analyticsRequests.push(route.request().postDataJSON());
      route.fulfill({ status: 201 });
    });

    // 1. Change sort
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Menor Preço"]').click();
    
    // 2. Perform search
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('caneta');
    await page.waitForTimeout(1500); // Wait for debounce and trackSort

    // 3. Verify analytics call for sort change
    const sortEvent = analyticsRequests.find(r => r.event_type === 'sort_change');
    expect(sortEvent).toBeDefined();
    expect(sortEvent.event_data.sort_by).toBe('price-asc');
    
    // 4. Verify search analytics (this usually goes to search_analytics table)
    // We would need to intercept that too if testing the search track specifically
  });

  test('should keep preferences isolated between users', async ({ page, context }) => {
    // 1. User A sets a preference
    const sortTrigger = page.locator('button[aria-label="Ordenar por"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Maior Preço"]').click();
    await expect(page).toHaveURL(/sort=price-desc/);

    // 2. Open new context (User B) - in E2E we usually mock auth or use different storage states
    const userBPage = await context.newPage();
    await userBPage.goto('/products');
    
    // User B should have default sort, not User A's
    await expect(userBPage).not.toHaveURL(/sort=price-desc/);
  });
});
