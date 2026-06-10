import { test, expect } from '@playwright/test';

test.describe('Auth and Protected Routes Stability', () => {
  test('should redirect unauthenticated user to login without white screen', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/favoritos');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth/);
    
    // Login page should be visible
    await expect(page.locator('h1')).toContainText(/Entrar/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('AuthProvider should wrap main application routes', async ({ page }) => {
    await page.goto('/');
    
    // Check if the app is rendered (not a blank page)
    await expect(page.locator('#root')).not.toBeEmpty();
    
    // The presence of common elements suggests AuthProvider and other providers are working
    await expect(page.locator('header')).toBeVisible();
  });
});
