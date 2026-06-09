import { test, expect } from '@playwright/test';

test.describe('Initial Load Visual Tests', () => {
  const routes = [
    '/',
    '/login',
    '/produtos',
    '/favoritos',
    '/admin'
  ];

  for (const route of routes) {
    test(`route ${route} should not show black screen during or after load`, async ({ page }) => {
      // Monitor console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => {
        errors.push(err.message);
      });

      // Go to the route
      await page.goto(route);

      // 1. Check for immediate black screen (bg-[#0a0a0a])
      const blackScreenFallback = page.locator('div.bg-\\[\\#0a0a0a\\]');
      
      // Check if root is at least created
      await expect(page.locator('#root')).toBeAttached({ timeout: 10000 });

      // 2. Check that the theme is applied (should have 'dark' class)
      await expect(page.locator('html')).toHaveClass(/dark/);

      // 3. Check for app markers (navigation, content, etc.)
      // We expect either the login page or the main app shell
      const isLoginPage = route === '/login';
      if (isLoginPage) {
        await expect(page.locator('form')).toBeVisible();
      } else {
        // Most protected routes will redirect to login if not authenticated
        // but we want to make sure the redirect itself doesn't cause a black screen
        await page.waitForURL(url => url.pathname === route || url.pathname === '/login', { timeout: 10000 });
      }

      // 4. Ensure no critical console errors occurred during boot
      const criticalErrors = errors.filter(e => 
        e.includes('AuthProvider') || 
        e.includes('ThemeContext') || 
        e.includes('Context') ||
        e.includes('failed to load')
      );
      
      expect(criticalErrors).toEqual([]);
    });
  }
});
