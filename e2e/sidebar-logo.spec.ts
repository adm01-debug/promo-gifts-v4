import { test, expect } from '@playwright/test';

test.describe('Sidebar Logo Visual Regression', () => {
  test('should render small logo correctly in sidebar on desktop', async ({ page }) => {
    await page.goto('/');

    // Wait for sidebar to be visible
    const sidebar = page.locator('aside[data-tour="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Check brand header padding and logo container
    const brandHeader = page.locator('[data-testid="sidebar-brand-header"]');
    await expect(brandHeader).toBeVisible();

    // Verify logo components
    const logoIcon = brandHeader.locator('svg.lucide-gift');
    await expect(logoIcon).toBeVisible();

    const logoText = brandHeader.getByText('Promo Gifts');
    await expect(logoText).toBeVisible();

    const subText = brandHeader.getByText('Store System');
    await expect(subText).toBeVisible();

    // Visual sanity check for sizes (rough bounds)
    const iconBox = await logoIcon.boundingBox();
    expect(iconBox?.width).toBeLessThan(20); // Delicate icon

    const textBox = await logoText.boundingBox();
    expect(textBox?.height).toBeLessThan(25); // Delicate text
  });

  test('should handle collapsed sidebar logo', async ({ page }) => {
    await page.goto('/');

    // Toggle collapse if button exists
    const toggleBtn = page.getByLabel('Recolher menu');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
    }

    const brandHeader = page.locator('[data-testid="sidebar-brand-header"]');
    const logoText = brandHeader.getByText('Promo Gifts');

    // Text should be hidden in collapsed mode (showText={false})
    await expect(logoText).not.toBeVisible();

    const logoIcon = brandHeader.locator('svg.lucide-gift');
    await expect(logoIcon).toBeVisible();
  });
});
