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
    await inicioBreadcrumb.hover();
    
    const inicioTooltip = page.locator('text=Leva você de volta ao Catálogo (Home)');
    await expect(inicioTooltip).toBeVisible();
    await expect(inicioTooltip).toContainText('Use para recomeçar sua busca do zero');

    // Check "Teletransporte" button tooltip
    const backButton = page.getByTestId('back-teleport-button');
    await expect(backButton).toBeVisible();
    await backButton.hover();

    const teleportTooltip = page.locator('text=Retorna para a página anterior');
    await expect(teleportTooltip).toBeVisible();
    await expect(teleportTooltip).toContainText('Diferente do Início, ele mantém seu progresso anterior');
  });
});
