import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';

test.describe('Global Search Comprehensive', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/');
    // Garantir que a página carregou
    await expect(page.locator('button[aria-label="Abrir busca global"]')).toBeVisible();
  });

  test('Open palette with modifier+K and Button click', async ({ page }) => {
    // Test click trigger
    await page.click('button[aria-label="Abrir busca global"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Buscar produtos"]')).toBeFocused();
    
    // Close palette
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Test shortcut trigger (modifier+K)
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+k`);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('Voice search shortcut Ctrl+Shift+V', async ({ page }) => {
    // Open palette first (shortcut works both open and closed, but tooltip is in palette trigger)
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('v');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');

    // Should open voice overlay (check for "Fale agora" text which is common in these overlays)
    await expect(page.locator('text=Fale agora')).toBeVisible();
  });

  test('Navigation and Selection in Idle State', async ({ page }) => {
    await page.click('button[aria-label="Abrir busca global"]');
    
    // In Idle state we have "Mais Populares" or "Recentes"
    const items = page.locator('[cmdk-item]');
    
    // Wait for at least one item to be available (Popular products)
    await expect(items.first()).toBeVisible();

    // Test arrow down
    await page.keyboard.press('ArrowDown');
    await expect(items.first()).toHaveAttribute('data-selected', 'true');
    
    // Test 1-9 shortcuts (numeric selection)
    // We need to move focus from input to the list to use numeric shortcuts
    await page.keyboard.press('Tab'); 
    
    // Press '1' to select first item
    await page.keyboard.press('1');
    
    // Verify navigation (should go to a product page or similar, not home)
    await expect(page).not.toHaveURL(/\/$/, { timeout: 10000 });
  });

  test('Visual Snapshots of search states', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // 1. Idle State
    await page.click('button[aria-label="Abrir busca global"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot('global-search-idle.png');

    // 2. Searching State
    await page.fill('input[placeholder*="Buscar produtos"]', 'caneca');
    // Check for AI processing banner
    await expect(page.locator('text=Analisando sua busca...')).toBeVisible();
    await expect(dialog).toHaveScreenshot('global-search-searching.png');
  });
});
