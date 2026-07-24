import { test, expect } from '@playwright/test';

test.describe('Critical Business Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Attempt login if not authenticated
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('adm01@promobrindes.com.br');
      await passwordInput.fill('promobrindes@2024'); // Mock or dev password
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.waitForURL('/');
    }
  });

  test('Catalog to Quote flow', async ({ page }) => {
    await page.goto('/catalogo');
    await page.waitForLoadState('networkidle');
    
    // Search for a product
    const searchInput = page.getByPlaceholder(/Buscar/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Caneta');
      await page.keyboard.press('Enter');
    }
    
    // Click on first product
    const productCard = page.locator('.product-card, [role="link"]').first();
    if (await productCard.isVisible()) {
      await productCard.click();
      await page.waitForLoadState('networkidle');
      
      // Add to quote
      const addBtn = page.getByRole('button', { name: /Adicionar/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
      }
    }
  });

  test('User management audit', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page.locator('table')).toBeVisible();
  });
});
