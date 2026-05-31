import { test, expect } from '@playwright/test';

test.describe('Estoque Dashboard E2E', () => {
  test('should load stock data correctly without white screen', async ({ page }) => {
    // Navigate to /estoque
    await page.goto('/estoque');

    // Wait for the page title to be visible
    await expect(page.locator('[data-testid="page-title-estoque"]')).toBeVisible();

    // Check for loading state first (if it appears)
    const loadingState = page.locator('text=Sincronizando estoque');
    if (await loadingState.isVisible()) {
      // Wait for loading to finish
      await expect(loadingState).not.toBeVisible({ timeout: 30000 });
    }

    // Ensure no 410 error or "Gone" message is visible
    const goneError = page.locator('text=Gone');
    await expect(goneError).not.toBeVisible();
    
    const discontinuedError = page.locator('text=Esta função foi descontinuada');
    await expect(discontinuedError).not.toBeVisible();

    // Verify dashboard components are rendered
    await expect(page.locator('text=Visão Geral')).toBeVisible();
    
    // Check for at least one StatCard
    await expect(page.locator('text=Total de Produtos')).toBeVisible();

    // Check if the stock table or a "no data" message is present
    // (In some environments there might be no products, so we check for both)
    const stockTable = page.locator('table');
    const noDataMessage = page.locator('text=Nenhum produto encontrado');
    
    await expect(stockTable.or(noDataMessage)).toBeVisible();

    // Final check for console errors
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));
    
    // Refresh and check again to be sure
    await page.reload();
    await expect(page.locator('[data-testid="page-title-estoque"]')).toBeVisible();
    
    // Check filters - clicking "Sem Estoque" should filter
    const outOfStockCard = page.locator('text=Sem Estoque').first();
    await outOfStockCard.click();
    // Wait for network activity if any (though current implementation filters locally)
    await page.waitForTimeout(500);
    
    // Search check
    const searchInput = page.getByPlaceholder('Buscar produto, SKU ou cor...');
    await searchInput.fill('SKU_INEXISTENTE_TESTE');
    await expect(page.locator('text=Nenhum produto encontrado')).toBeVisible();

    const hasGoneLog = logs.some(log => log.includes('410') || log.includes('Gone'));
    expect(hasGoneLog).toBe(false);
  });
});
