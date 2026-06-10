import { test, expect } from './fixtures/test-base';
import { gotoAndSettle } from './helpers/nav';
import { loginAs } from './helpers/auth';

test.describe('Catalog Toolbar Duplication Check', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 667 }
  ];

  for (const vp of viewports) {
    test(`Verify single toolbar on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/');
      
      // Wait for the catalog to load
      await page.waitForSelector('h1:has-text("Catálogo de Produtos")');
      
      // Selectors for both potential toolbars
      const headerToolbar = page.locator('.flex-col > .flex-wrap .animate-in > [aria-label*="filtros"], .flex-col > .flex-wrap .animate-in > .flex-wrap');
      const gridToolbar = page.locator('[data-testid="virtualized-product-grid"] .sticky .flex-wrap');
      
      // In our current refactor, header toolbar should be the only one visible initially.
      // Grid toolbar only appears inside the virtualized grid container.
      
      // Check for elements that identify the toolbar (Filters button)
      const filterButtons = page.locator('button:has-text("Filtros")');
      const sortTriggers = page.locator('[data-testid="catalog-sort-trigger"]');
      
      // If we want only ONE toolbar visible at a time:
      // The header one is static, the grid one is sticky inside the grid.
      // But they should NOT be visible simultaneously if we are at the top.
      
      const visibleFilterButtons = await filterButtons.filter({ visible: true }).count();
      const visibleSortTriggers = await sortTriggers.filter({ visible: true }).count();
      
      console.log(`${vp.name}: Visible Filter Buttons: ${visibleFilterButtons}`);
      console.log(`${vp.name}: Visible Sort Triggers: ${visibleSortTriggers}`);

      // We expect exactly 1 of each to be visible at the top of the page
      expect(visibleFilterButtons).toBe(1);
      expect(visibleSortTriggers).toBe(1);
      
      // Visual regression of the header area
      const headerArea = page.locator('div.mx-auto.w-full.animate-fade-in > div:first-child');
      await expect(headerArea).toHaveScreenshot(`catalog-header-toolbar-${vp.name}.png`);
    });
  }

  test('Toolbar consistency during scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, '/');
    
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500);
    
    // After scrolling, the header toolbar might be out of view, and the grid toolbar might be sticky.
    // However, if we refactored to use ONE instance, we should still only see ONE.
    const filterButtons = page.locator('button:has-text("Filtros")');
    const visibleCount = await filterButtons.filter({ visible: true }).count();
    
    expect(visibleCount).toBe(1);
  });
});
