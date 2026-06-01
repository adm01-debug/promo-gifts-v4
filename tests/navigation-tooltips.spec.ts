import { test, expect } from '@playwright/test';

test.describe('Navigation Tooltips and Analytics', () => {
  test('should show correct tooltips for Início and Teletransporte', async ({ page }) => {
    // 1. Start at home
    await page.goto('/');
    
    // 2. Navigate to a product page to enable Teletransporte button
    // We assume there's a product link. If not, we navigate directly.
    await page.goto('/produtos');

    // Check "Início" breadcrumb tooltip
    const inicioBreadcrumb = page.getByTestId('home-breadcrumb-link');
    await expect(inicioBreadcrumb).toBeVisible();
    await inicioBreadcrumb.hover();
    
    // Using a more flexible locator for tooltip content
    await expect(page.locator('[role="tooltip"]')).toBeVisible();
    await expect(page.locator('[role="tooltip"]')).toContainText('Catálogo (Home)');
    await expect(page.locator('[role="tooltip"]')).toContainText('recomeçar sua busca do zero');

    // Check "Teletransporte" button tooltip
    const backButton = page.getByTestId('back-teleport-button');
    await expect(backButton).toBeVisible();
    await backButton.hover();

    await expect(page.locator('[role="tooltip"]')).toBeVisible();
    await expect(page.locator('[role="tooltip"]')).toContainText('página anterior');
    await expect(page.locator('[role="tooltip"]')).toContainText('mantém seu progresso anterior');
  });
});
