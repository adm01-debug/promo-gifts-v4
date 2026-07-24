import { test, expect, devices } from '@playwright/test';

/**
 * Audit for RoleBadge Tooltips.
 * Ensures no explanation tooltips appear on hover or long-press.
 */
test.describe('RoleBadge - Tooltip Audit', () => {

  test('should not show tooltip or native title on hover (Desktop)', async ({ page }) => {
    // Navigate to a page where the header (and RoleBadge) is visible
    await page.goto('/');
    
    // Wait for header to be visible
    const header = page.locator('[data-testid="app-header"]');
    await expect(header).toBeVisible();

    // The RoleBadge is typically near the user avatar in the header
    const roleBadge = page.locator('.inline-flex.gap-1.font-medium').first();
    
    // Check if RoleBadge is present (might need to wait for roles to load)
    await expect(roleBadge).toBeVisible({ timeout: 10000 });
    
    // 1. Check for native 'title' attribute
    const titleAttr = await roleBadge.getAttribute('title');
    expect(titleAttr).toBeFalsy();
    
    // 2. Hover and verify no tooltip appears
    await roleBadge.hover();
    await page.waitForTimeout(1000); // Wait to see if a tooltip pops up
    
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content], .rt-TooltipContent');
    await expect(tooltip).not.toBeVisible();
  });

  test('should not show explanation on long-press (Mobile)', async ({ page }) => {
    // Emulate a mobile device
    // This test will run with the default viewport unless specified, 
    // but we can use the 'devices' from playwright if needed in the config.
    // Here we'll just simulate touch behavior.
    
    await page.goto('/');
    
    const roleBadge = page.locator('.inline-flex.gap-1.font-medium').first();
    await expect(roleBadge).toBeVisible({ timeout: 10000 });

    // Simulate long press (tap and hold)
    await roleBadge.tap(); // Normal tap
    await page.mouse.move(0, 0); // Move away
    
    // Long press
    const box = await roleBadge.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(1500); // Typical long-press duration
      await page.mouse.up();
    }

    // Ensure no tooltip or popover explanation appeared
    const tooltip = page.locator('[role="tooltip"], [data-radix-tooltip-content], .rt-TooltipContent');
    await expect(tooltip).not.toBeVisible();
    
    // Check for any text that looks like a role description (e.g. "Possui acesso total")
    // Note: getRoleVisual returns descriptions like "Possui acesso total ao sistema" for admin.
    const explanationText = page.locator('text=/acesso total/i');
    await expect(explanationText).not.toBeVisible();
  });
});
