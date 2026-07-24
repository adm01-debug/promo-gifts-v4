import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';

test.describe('Global Search Voice Tooltip @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/');
    // Wait for header/search to be stable
    await expect(page.locator('button[aria-label="Fale com o Flow"]')).toBeVisible();
  });

  test('Tooltip shows and disappears on Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const micButton = page.locator('button[aria-label="Fale com o Flow"]');

    
    // Hover to trigger tooltip
    await micButton.hover();
    
    // Check tooltip content
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Fale com o Flow');
    await expect(tooltip).toContainText('Ctrl+Shift+V');
    
    // Visual Regression
    await expect(tooltip).toHaveScreenshot('voice-tooltip-desktop.png');

    // Move mouse away and check if it disappears
    await page.mouse.move(0, 0);
    await expect(tooltip).not.toBeVisible();

    // Test focus trigger and blur
    await micButton.focus();
    await expect(tooltip).toBeVisible();
    await micButton.blur();
    await expect(tooltip).not.toBeVisible();
  });

  test('Tooltip shows and disappears on Mobile @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const micButton = page.locator('button[aria-label="Fale com o Flow"]');
    
    // On mobile, tap/focus usually triggers the tooltip
    await micButton.focus();
    
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Fale com o Flow');
    
    // Visual Regression mobile
    await expect(tooltip).toHaveScreenshot('voice-tooltip-mobile.png');

    // Lose focus and check if it disappears
    await micButton.blur();
    await expect(tooltip).not.toBeVisible();
  });
});
