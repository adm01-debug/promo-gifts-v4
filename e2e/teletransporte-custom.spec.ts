import { test, expect } from '@playwright/test';

test.describe('Teletransporte (Smart Back Button) Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Start at home
    await page.goto('/');
    // Wait for the app to be ready
    await page.waitForLoadState('networkidle');
  });

  test('Teletransporte should go back in history correctly: Home -> Products -> Back', async ({ page }) => {
    // 1. Navigate to Products
    await page.goto('/produtos');
    await expect(page).toHaveURL(/\/produtos/);

    // 2. Check if Teletransporte button is visible
    const teleportButton = page.getByTestId('back-teleport-button');
    await expect(teleportButton).toBeVisible();
    await expect(teleportButton).toContainText('Teletransporte');
    
    // Check for the portal icon (Zap) - we can check by class or name if accessible
    const icon = teleportButton.locator('svg');
    await expect(icon).toHaveClass(/text-sky-400/);

    // 3. Click Teletransporte
    await teleportButton.click();

    // 4. Should be back at Home (/)
    await expect(page).toHaveURL(/\/$/);
  });

  test('Teletransporte should go back in history correctly: Home -> Products -> Filters -> Back', async ({ page }) => {
    // 1. Home -> Products
    await page.goto('/produtos');
    await expect(page).toHaveURL(/\/produtos/);

    // 2. Products -> Filters
    await page.goto('/filtros');
    await expect(page).toHaveURL(/\/filtros/);

    // 3. Click Teletransporte
    const teleportButton = page.getByTestId('back-teleport-button');
    await teleportButton.click();

    // 4. Should be back at Products
    await expect(page).toHaveURL(/\/produtos/);

    // 5. Click Teletransporte again
    await teleportButton.click();

    // 6. Should be back at Home
    await expect(page).toHaveURL(/\/$/);
  });

  test('Teletransporte should fallback to home if history is shallow', async ({ page }) => {
    // Directly go to a deep page (history length will be small)
    await page.goto('/filtros');
    await expect(page).toHaveURL(/\/filtros/);

    const teleportButton = page.getByTestId('back-teleport-button');
    await expect(teleportButton).toBeVisible();

    // Click Teletransporte
    await teleportButton.click();

    // Should go to Home because history.length is likely <= 2 in a fresh page load
    await expect(page).toHaveURL(/\/$/);
  });

  test('Teletransporte should handle complex module navigation: Home -> Admin -> Skins -> Back', async ({ page }) => {
    // 1. Home -> Admin
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);

    // 2. Admin -> Skins (temas)
    await page.goto('/admin/temas');
    await expect(page).toHaveURL(/\/admin\/temas/);

    // 3. Click Teletransporte
    const teleportButton = page.getByTestId('back-teleport-button');
    await teleportButton.click();

    // 4. Should be back at Admin
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Teletransporte should have a tooltip explaining its purpose', async ({ page }) => {
    await page.goto('/produtos');
    const teleportButton = page.getByTestId('back-teleport-button');
    
    await teleportButton.hover();
    
    const tooltip = page.getByTestId('teleport-tooltip-content');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('página anterior');
    await expect(tooltip).toContainText('Teletransporte');
  });
});
