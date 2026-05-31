import { test, expect } from '@playwright/test';

test.describe('Estoque Dashboard E2E', () => {
  test('should load stock data correctly and handle filters/pagination/sorting', async ({ page }) => {
    // Navigate to /estoque
    await page.goto('/estoque');

    // Wait for the page title to be visible
    await expect(page.locator('[data-testid="page-title-estoque"]')).toBeVisible();

    // Check for loading state first (if it appears)
    const loadingState = page.locator('text=Sincronizando estoque');
    if (await loadingState.isVisible()) {
      // Wait for loading to finish
      await expect(loadingState).not.toBeVisible({ timeout: 45000 });
    }

    // Capture logs to detect 410 Gone
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    // 1. Ensure no 410 error or "Gone" message is visible
    const goneError = page.locator('text=Gone');
    await expect(goneError).not.toBeVisible();
    
    const discontinuedError = page.locator('text=Esta função foi descontinuada');
    await expect(discontinuedError).not.toBeVisible();

    // 2. Verify dashboard components are rendered
    await expect(page.locator('text=Visão Geral')).toBeVisible();
    await expect(page.locator('text=Total de Produtos')).toBeVisible();

    // 3. Check if the stock table or a "no data" message is present
    const stockTable = page.locator('table');
    const noDataMessage = page.locator('text=Nenhum produto encontrado');
    await expect(stockTable.or(noDataMessage)).toBeVisible();

    // 4. Test Filters - Clicking "Sem Estoque" card should filter products
    const outOfStockCard = page.locator('text=Sem Estoque').first();
    await outOfStockCard.click();
    
    // Verify filter badge appears
    await expect(page.locator('text=Filtro ativo:')).toBeVisible();
    await expect(page.locator('text=Sem Estoque')).toBeVisible();

    // 5. Test Search - Use a search term
    const searchInput = page.getByPlaceholder('Buscar no Estoque (Nome, SKU ou Cor)...');
    await searchInput.fill('SKU_INEXISTENTE_TESTE_PROMO');
    await expect(page.locator('text=Nenhum produto encontrado')).toBeVisible();
    
    // Clear search
    await page.locator('button[aria-label="Remover filtro"], .absolute.right-2.top-1\\/2').first().click();

    // 6. Test Sorting via Advanced Filters
    await page.locator('button:has-text("Filtros")').click();
    await page.locator('text=Ordenar por').click();
    
    // Select sorting option
    await page.locator('button[role="combobox"]').last().click();
    await page.locator('text=Nome (A-Z)').click();
    
    // Close popover
    await page.locator('text=Fechar').click();

    // 7. Test Pagination (if data exists)
    const nextButton = page.locator('button:has-text("Próxima")');
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.locator('text=Página 2')).toBeVisible();
    }

    // Final check for console errors related to the bridge
    const hasGoneLog = logs.some(log => log.includes('410') || log.includes('Gone') || log.includes('external-db-bridge'));
    expect(hasGoneLog).toBe(false);
  });
});

