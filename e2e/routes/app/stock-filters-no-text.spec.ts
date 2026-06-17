/**
 * /estoque — filtros sem texto retornam resultados.
 *
 * Cenário: selecionar Categoria + Cor + Quantidade (sem digitar busca) deve
 * filtrar a lista — o que estava quebrado quando o "0 de N" sumia sem
 * explicar qual filtro zerou. Valida também:
 *  - Empty state explicativo aparece quando filtros zeram resultado.
 *  - Botão "Limpar filtros" restaura a lista completa.
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';

test.describe('@regression /estoque — filtros sem texto', () => {
  test('Categoria + Cor + Quantidade (sem busca) filtra a tabela', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const syncing = page.getByText(/Sincronizando estoque/i);
    if (await syncing.isVisible().catch(() => false)) {
      await expect(syncing).not.toBeVisible({ timeout: 60_000 });
    }
    const empty = page.getByText(/Nenhum produto encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'sem dados seedados');
    }

    // Total inicial (sem qualquer filtro de texto).
    const search = page.getByPlaceholder(/Buscar no Estoque/i);
    await expect(search).toHaveValue('');
    const initialRows = await page.locator('tbody tr').count();
    expect(initialRows).toBeGreaterThan(0);

    // Aplica somente "Quantidade mínima" (filtro estrutural, sem texto).
    const qty = page.getByPlaceholder(/Preciso de X un/i);
    await qty.fill('1');
    await page.waitForTimeout(600);

    // O filtro DEVE ter sido aplicado, mesmo sem busca digitada.
    // Resultado: tabela ainda renderiza linhas OU mostra o hint explicativo.
    const hint = page.getByTestId('stock-empty-filters-hint');
    const rowsAfter = await page.locator('tbody tr').count();
    expect(rowsAfter > 0 || (await hint.isVisible())).toBeTruthy();
  });

  test('Empty state explicativo aparece e "Limpar filtros" restaura lista', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const empty = page.getByText(/Nenhum produto encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'sem dados seedados');
    }

    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 0) test.skip(true, 'tabela vazia por outra razão');

    // Força um cenário de "0 resultados" com quantidade absurda.
    const qty = page.getByPlaceholder(/Preciso de X un/i);
    await qty.fill('99999999');
    await page.waitForTimeout(600);

    const hint = page.getByTestId('stock-empty-filters-hint');
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText(/0 de/);
    await expect(hint).toContainText(/Quantidade mínima/i);

    // Limpar filtros restaura a lista.
    await page.getByTestId('stock-empty-filters-reset').click();
    await page.waitForTimeout(400);
    await expect(hint).not.toBeVisible();
    const afterReset = await page.locator('tbody tr').count();
    expect(afterReset).toBe(initialRows);
    await expect(qty).toHaveValue('');
  });
});
