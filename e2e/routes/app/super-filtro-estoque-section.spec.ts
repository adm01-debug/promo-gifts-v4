/**
 * Super Filtro (/filtros) — seção "Estoque" no sidebar.
 *
 * Garante que a seção "Estoque" esteja:
 *  1. Visível no sidebar do FilterPanel (renderer 'estoque').
 *  2. Iniciada FECHADA (chevron-down) e abrindo via click (chevron-up).
 *  3. Fechável de novo (chevron retorna a down).
 *  4. Persistindo a seleção de "Em Estoque" via URL searchParam (?inStock=1)
 *     ao navegar para outra rota e voltar.
 *
 * Contexto: a seção foi REMOVIDA apenas em /estoque (popover redundante),
 * mas DEVE permanecer no Super Filtro. Ver doc-block em
 * src/components/inventory/StockFilterToolbar.tsx → setIncludeFutureStock.
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';

test.describe('@regression /filtros — sidebar Super Filtro: seção Estoque', () => {
  test('Estoque está visível e chevron abre/fecha sem inconsistência', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/filtros');

    const trigger = page.getByTestId('filter-section-trigger-estoque');
    await expect(trigger).toBeVisible({ timeout: 15_000 });

    // Estado inicial: fechada.
    await expect(trigger).toHaveAttribute('data-state-open', 'false');

    // Click → abre (chevron up via data-state-open=true).
    await trigger.click();
    await expect(trigger).toHaveAttribute('data-state-open', 'true');

    // Conteúdo da seção (checkbox "Em Estoque") deve estar visível.
    const inStockCheckbox = page.locator('#filter-inStock');
    await expect(inStockCheckbox).toBeVisible();

    // Click novamente → fecha (accordion atomicidade).
    await trigger.click();
    await expect(trigger).toHaveAttribute('data-state-open', 'false');
  });

  test('Seleção "Em Estoque" persiste via URL ao navegar entre telas', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/filtros');

    // Abre seção e marca "Em Estoque".
    await page.getByTestId('filter-section-trigger-estoque').click();
    const inStock = page.locator('#filter-inStock');
    await expect(inStock).toBeVisible();
    await inStock.click();

    // useFiltersPageState grava inStock=1 no searchParams.
    await expect(page).toHaveURL(/[?&]inStock=1/, { timeout: 5_000 });

    // Sai e volta usando a mesma URL (simula bookmark / back/forward).
    const urlWithFilter = page.url();
    await gotoAndSettle(page, '/');
    await page.goto(urlWithFilter);

    // Após o retorno, a seção deve estar visível e o checkbox marcado.
    const triggerAfter = page.getByTestId('filter-section-trigger-estoque');
    await expect(triggerAfter).toBeVisible({ timeout: 15_000 });
    await triggerAfter.click();
    await expect(page.locator('#filter-inStock')).toBeChecked();
  });
});
