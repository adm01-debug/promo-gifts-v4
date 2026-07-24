/**
 * Super Filtro (/filtros) — seção "Estoque" no sidebar.
 *
 * Garante que a seção "Estoque" esteja:
 *  1. Visível no sidebar do FilterPanel (renderer 'estoque').
 *  2. Iniciada FECHADA (chevron-down) e abrindo via click (chevron-up).
 *  3. Fechável de novo (chevron retorna a down).
 *  4. Hover NÃO abre/fecha a seção — apenas click (Collapsible do Radix).
 *     Esse teste evita regressão para o bug histórico em que chevrons abriam
 *     no hover causando "piscar" do conteúdo ao passar o mouse.
 *  5. Persistindo a seleção de "Em Estoque" via URL searchParam (?inStock=1)
 *     ao navegar para outra rota e voltar.
 *  6. "Limpar filtros" (botão Reset) restaura estado inicial + limpa a URL.
 *
 * Contexto: a seção foi REMOVIDA apenas em /estoque (popover redundante),
 * mas DEVE permanecer no Super Filtro. Ver doc-block em
 * src/components/inventory/StockFilterToolbar.tsx → setIncludeFutureStock.
 *
 * Dados: a seção "Estoque" não depende de seed (renderiza incondicionalmente).
 * Para validar o EFEITO do filtro sobre a grade, use scripts/e2e-check-stock-seed.mjs.
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

  test('Hover sobre o chevron NÃO abre nem fecha a seção (somente click)', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/filtros');

    const trigger = page.getByTestId('filter-section-trigger-estoque');
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await expect(trigger).toHaveAttribute('data-state-open', 'false');

    // Hover repetido — não deve alternar estado.
    await trigger.hover();
    await page.waitForTimeout(400);
    await expect(trigger).toHaveAttribute('data-state-open', 'false');
    await expect(page.locator('#filter-inStock')).toHaveCount(0);

    // Move o mouse para fora e volta — ainda fechada.
    await page.mouse.move(0, 0);
    await trigger.hover();
    await page.waitForTimeout(200);
    await expect(trigger).toHaveAttribute('data-state-open', 'false');

    // Click explícito abre (controle positivo do teste).
    await trigger.click();
    await expect(trigger).toHaveAttribute('data-state-open', 'true');

    // Agora aberta: hover não deve fechar.
    await page.mouse.move(0, 0);
    await trigger.hover();
    await page.waitForTimeout(300);
    await expect(trigger).toHaveAttribute('data-state-open', 'true');
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

  test('"Limpar filtros" (Reset) zera seleção de Estoque e remove da URL', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/filtros');

    // Marca "Em Estoque".
    await page.getByTestId('filter-section-trigger-estoque').click();
    const inStock = page.locator('#filter-inStock');
    await expect(inStock).toBeVisible();
    await inStock.click();
    await expect(inStock).toBeChecked();
    await expect(page).toHaveURL(/[?&]inStock=1/, { timeout: 5_000 });

    // Clica em Reset (botão fica habilitado quando activeFiltersCount > 0).
    const reset = page.getByRole('button', { name: /Resetar todos os filtros/i });
    await expect(reset).toBeEnabled();
    await reset.click();

    // URL: o param inStock deve sumir.
    await expect(page).not.toHaveURL(/[?&]inStock=1/, { timeout: 5_000 });

    // Reset colapsa todas as seções (collapseAllSections). Reabre Estoque
    // para conferir que o checkbox voltou ao estado inicial (desmarcado).
    const triggerAfter = page.getByTestId('filter-section-trigger-estoque');
    await expect(triggerAfter).toHaveAttribute('data-state-open', 'false');
    await triggerAfter.click();
    await expect(page.locator('#filter-inStock')).not.toBeChecked();

    // Botão Reset volta a ficar desabilitado (sem filtros ativos).
    await expect(reset).toBeDisabled();
  });
});
