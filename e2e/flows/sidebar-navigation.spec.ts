import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';

test.describe('Sidebar Navigation Reorganization', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin or regular user (both should see catalog)
    await loginAs(page);
    await page.goto('/');
    // Wait for sidebar to be visible
    await expect(page.locator('[data-tour="sidebar"]')).toBeVisible();
  });

  test('Module order: ESTOQUE should be above COLEÇÕES (Desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Find the Catalog group
    const catalogGroup = page.locator('nav').filter({ hasText: /Catálogo/i });
    
    // Get all links in the catalog group
    const links = catalogGroup.locator('a');
    const labels = await links.allInnerTexts();
    
    // Find indices of "Estoque" and "Coleções"
    const estoqueIndex = labels.findIndex(text => text.includes('Estoque'));
    const colecoesIndex = labels.findIndex(text => text.includes('Coleções'));
    
    expect(estoqueIndex).toBeGreaterThan(-1);
    expect(colecoesIndex).toBeGreaterThan(-1);
    expect(estoqueIndex).toBeLessThan(colecoesIndex);
  });

  test('Module order: ESTOQUE should be above COLEÇÕES (Mobile)', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // On mobile, the sidebar might be closed initially
    // Check if we need to open it (usually via a button in the header)
    const menuButton = page.locator('button[aria-label*="menu" i]').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    
    // Find the Catalog group
    const catalogGroup = page.locator('[data-tour="sidebar"] nav').filter({ hasText: /Catálogo/i });
    
    // Get all links in the catalog group
    const links = catalogGroup.locator('a');
    const labels = await links.allInnerTexts();
    
    // Find indices of "Estoque" and "Coleções"
    const estoqueIndex = labels.findIndex(text => text.includes('Estoque'));
    const colecoesIndex = labels.findIndex(text => text.includes('Coleções'));
    
    expect(estoqueIndex).toBeGreaterThan(-1);
    expect(colecoesIndex).toBeGreaterThan(-1);
    expect(estoqueIndex).toBeLessThan(colecoesIndex);
  });

  test('Navigation: Links and routes for ESTOQUE and COLEÇÕES', async ({ page }) => {
    // Check Estoque link
    const estoqueLink = page.locator('a').filter({ hasText: /^Estoque$/i });
    await expect(estoqueLink).toHaveAttribute('href', '/estoque');
    
    // Navigate and verify
    await estoqueLink.click();
    await expect(page).toHaveURL(/\/estoque/);
    
    // Go back or open sidebar again if on mobile
    if (page.viewportSize()?.width! < 1024) {
        const menuButton = page.locator('button[aria-label*="menu" i]').first();
        await menuButton.click();
    }
    
    // Check Coleções link
    const colecoesLink = page.locator('a').filter({ hasText: /^Coleções$/i });
    await expect(colecoesLink).toHaveAttribute('href', '/colecoes');
    
    // Navigate and verify
    await colecoesLink.click();
    await expect(page).toHaveURL(/\/colecoes/);
  });

  test('Visual Regression: Sidebar modules layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const sidebar = page.locator('[data-tour="sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // Initial snapshot
    await expect(sidebar).toHaveScreenshot('sidebar-layout-initial.png');
    
    // Interact: scroll within sidebar if possible
    const nav = sidebar.locator('nav');
    await nav.evaluate(node => node.scrollTo(0, 100));
    await page.waitForTimeout(300);
    
    // Snapshot after scroll
    await expect(sidebar).toHaveScreenshot('sidebar-layout-scrolled.png');
  });
});
