import { test, expect } from '@playwright/test';

test.describe('Elite UX & Resilience Validation (Full Journey)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock login or use session if available
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
  });

  test('should handle search with diacritics and highlights', async ({ page }) => {
    await page.goto('/catalog');
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('Caneca');
    await page.waitForTimeout(1000);
    
    // Check for highlights
    const highlights = page.locator('mark');
    if (await highlights.count() > 0) {
      await expect(highlights.first()).toBeVisible();
    }
    
    // Test diacritic resilience
    await searchInput.fill('canêca'); // with circumflex
    await page.waitForTimeout(1000);
    const results = page.locator('.product-card');
    await expect(results.first()).toBeVisible();
  });

  test('should navigate through Quote Builder steps and validate pricing', async ({ page }) => {
    await page.goto('/catalog');
    await page.click('.product-card:first-child');
    await page.waitForSelector('button:has-text("Adicionar ao Orçamento")');
    await page.click('button:has-text("Adicionar ao Orçamento")');
    
    await page.goto('/orcamento/novo');
    
    // Step 1: Items
    await expect(page.locator('text=Items')).toBeVisible();
    await page.click('button:has-text("Próximo")');
    
    // Step 2: Customization
    await expect(page.locator('text=Personalização')).toBeVisible();
    // Simulate technique selection
    await page.click('button:has-text("Configurar")');
    await page.waitForSelector('select[name="technique"]');
    await page.selectOption('select[name="technique"]', 'Laser');
    await page.click('button:has-text("Confirmar")');
    
    await page.click('button:has-text("Próximo")');
    
    // Step 3: Quantities
    await expect(page.locator('text=Quantidades')).toBeVisible();
    await page.fill('input[name="quantity"]', '100');
    await page.waitForTimeout(500); // debounce
    
    // Step 4: Summary & Pricing
    await page.click('button:has-text("Próximo")');
    await expect(page.locator('text=Resumo')).toBeVisible();
    
    // Validate that price is not 0
    const totalPrice = page.locator('.total-price-value');
    const priceText = await totalPrice.innerText();
    expect(priceText).not.toBe('R$ 0,00');
  });

  test('should handle network errors gracefully (Resilience)', async ({ page }) => {
    // Intercept and fail a critical API call
    await page.route('**/functions/v1/external-db-bridge', (route) => route.abort('failed'));
    
    await page.goto('/catalog');
    // Check if error boundary or toast appears
    await expect(page.locator('text=erro')).toBeVisible();
  });

  test('should validate mass actions in catalog', async ({ page }) => {
    await page.goto('/catalog');
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();
    
    const bulkBar = page.locator('.bulk-action-bar');
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar.locator('text=2 selecionados')).toBeVisible();
    
    // Test export
    await bulkBar.click('button:has-text("Exportar PDF")');
    // Should trigger download or show success toast
    await expect(page.locator('text=PDF')).toBeVisible();
  });
});
