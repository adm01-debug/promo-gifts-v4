import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';

test.describe('Global Search Voice Tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto('/');
    // Wait for header/search to be stable
    await expect(page.locator('button[aria-label="Microfone"]')).toBeVisible();
  });

  test('Tooltip shows "Fale com o Flow" on Desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    
    const micButton = page.locator('button[aria-label="Microfone"]');
    
    // Hover to trigger tooltip
    await micButton.hover();
    
    // Check tooltip content
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Fale com o Flow');
    await expect(tooltip).toContainText('Ctrl+Shift+V');
    
    // Visual Regression
    await expect(tooltip).toHaveScreenshot('voice-tooltip-desktop.png');
  });

  test('Tooltip shows "Fale com o Flow" on Mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // On mobile, tooltips are often triggered by tap or remain hidden if not supported 
    // but we can force hover/focus to verify the content exists in DOM/rendered state
    const micButton = page.locator('button[aria-label="Microfone"]');
    
    await micButton.tap(); // Tap might open overlay if not handled as hover, but we want to see tooltip
    await micButton.focus();
    
    const tooltip = page.locator('[role="tooltip"]');
    // If Radix tooltip on mobile shows on focus
    await expect(tooltip).toContainText('Fale com o Flow');
    
    // Visual Regression mobile
    await expect(tooltip).toHaveScreenshot('voice-tooltip-mobile.png');
  });
});
