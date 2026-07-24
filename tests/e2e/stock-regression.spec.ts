import { test, expect } from '@playwright/test';

test.describe('Estoque Dashboard E2E', () => {
  test('should load stock data correctly and handle filters/pagination/sorting', async ({ page }) => {
    await page.goto('/estoque');
    await expect(page.locator('[data-testid="page-title-estoque"]')).toBeVisible();

    const loadingState = page.locator('text=Sincronizando estoque');
    if (await loadingState.isVisible()) {
      await expect(loadingState).not.toBeVisible({ timeout: 45000 });
    }

    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    const goneError = page.locator('text=Gone');
    await expect(goneError).not.toBeVisible();
    const discontinuedError = page.locator('text=Esta função foi descontinuada');
    await expect(discontinuedError).not.toBeVisible();

    await expect(page.locator('text=Visão Geral')).toBeVisible();
    await expect(page.locator('text=Total de Produtos')).toBeVisible();

    const stockTable = page.locator('table');
    const noDataMessage = page.locator('text=Nenhum produto encontrado');
    await expect(stockTable.or(noDataMessage)).toBeVisible();

    const outOfStockCard = page.locator('text=Sem Estoque').first();
    await outOfStockCard.click();
    await expect(page.locator('text=Filtro ativo:')).toBeVisible();

    const searchInput = page.getByPlaceholder(/Buscar no Estoque/i);
    await searchInput.fill('SKU_INEXISTENTE_TESTE_PROMO');
    // Após removerem o debounce, a busca só aplica com Enter ou clique no botão "Busca".
    await searchInput.press('Enter');
    await expect(page.locator('text=Nenhum produto encontrado')).toBeVisible();
    await page.getByRole('button', { name: /Limpar busca/i }).click();


    await page.locator('button:has-text("Filtros")').click();
    await page.locator('text=Ordenar por').click();
    await page.locator('button[role="combobox"]').last().click();
    await page.locator('text=Nome (A-Z)').click();
    await page.locator('text=Fechar').click();

    const nextButton = page.locator('button:has-text("Próxima")');
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.locator('text=Página 2')).toBeVisible();
    }

    const hasGoneLog = logs.some(log => log.includes('410') || log.includes('Gone') || log.includes('external-db-bridge'));
    expect(hasGoneLog).toBe(false);
  });
});
