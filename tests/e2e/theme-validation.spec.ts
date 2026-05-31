import { test, expect } from '@playwright/test';

test.describe('Dark Mode Enforcement & Anti-Flash', () => {
  test('should have dark class on html and dark background on body during initial load', async ({ page }) => {
    // Navigate and check before hydration if possible, 
    // but at least check immediately after load
    await page.goto('/');

    // 1. Check HTML class
    const htmlClass = await page.getAttribute('html', 'class');
    expect(htmlClass).toContain('dark');
    expect(htmlClass).not.toContain('light');

    // 2. Check body background color (matches index.html inline style)
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // #0a0a0a is rgb(10, 10, 10)
    expect(bodyBg).toBe('rgb(10, 10, 10)');

    // 3. Ensure no "light" preference in localStorage can override it
    await page.evaluate(() => {
      localStorage.setItem('gifts-store-theme', 'light');
    });
    await page.reload();
    
    const htmlClassAfterReload = await page.getAttribute('html', 'class');
    expect(htmlClassAfterReload).toContain('dark');
    
    // 4. Check if theme-color meta tag is correct
    const themeColor = await page.getAttribute('meta[name="theme-color"]', 'content');
    expect(themeColor).toBe('#0a0a0a');
  });

  test('should not have any visible elements with light background in critical sections', async ({ page }) => {
    await page.goto('/auth'); // One of the critical routes

    // Check header
    const header = page.locator('header');
    if (await header.count() > 0) {
      const headerBg = await header.evaluate(el => window.getComputedStyle(el).backgroundColor);
      // It should be dark (low brightness)
      const rgb = headerBg.match(/\d+/g)?.map(Number);
      if (rgb) {
        const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        expect(brightness).toBeLessThan(100); // 0 is black, 255 is white
      }
    }
  });

  test('mobile menu should also be dark', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    
    // Open mobile menu if it exists (usually a button with "Menu" or an icon)
    const menuButton = page.locator('button[aria-label*="menu"], button:has(svg)');
    if (await menuButton.count() > 0) {
      await menuButton.first().click();
      // Wait for menu to appear
      const menu = page.locator('nav, [role="dialog"]');
      if (await menu.count() > 0) {
        const menuBg = await menu.evaluate(el => window.getComputedStyle(el).backgroundColor);
        const rgb = menuBg.match(/\d+/g)?.map(Number);
        if (rgb) {
          const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
          expect(brightness).toBeLessThan(100);
        }
      }
    }
  });
});
