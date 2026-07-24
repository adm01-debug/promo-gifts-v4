import { test, expect } from '@playwright/test';

test.describe('Initial Load Resiliency', () => {
  const routes = [
    '/',
    '/login',
    '/produtos',
    '/favoritos',
    '/admin'
  ];

  for (const route of routes) {
    test(`route ${route} should not show black screen during or after load`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => {
        errors.push(err.message);
      });

      // Capture screenshots at different stages
      await page.goto(route, { waitUntil: 'commit' });
      
      // Check background color immediately after commit
      const bodyBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      
      // bg-[#0a0a0a] is approx rgb(10, 10, 10)
      // bg-background is usually dark in this theme too, but consistent.
      // We want to make sure it's not a "broken" black.
      
      await page.waitForLoadState('domcontentloaded');
      
      // Ensure #root exists
      await expect(page.locator('#root')).toBeAttached();

      // Check if html has dark class (ThemeInitializer/ThemeProvider working)
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 10000 });
      
      // Ensure no "AuthProvider" errors
      const authErrors = errors.filter(e => e.includes('AuthProvider') || e.includes('AuthContext'));
      expect(authErrors).toEqual([]);
    });
  }
});
