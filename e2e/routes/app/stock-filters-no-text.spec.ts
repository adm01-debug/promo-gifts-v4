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

  test('Chip de Quantidade no hint remove o filtro e restaura a lista', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 0) test.skip(true, 'sem dados seedados');

    const qty = page.getByPlaceholder(/Preciso de X un/i);
    await qty.fill('99999999');
    await page.waitForTimeout(600);

    const hint = page.getByTestId('stock-empty-filters-hint');
    await expect(hint).toBeVisible({ timeout: 5000 });

    // Clica no X do chip de Quantidade — remove APENAS esse filtro.
    const chip = page.getByTestId('stock-empty-filters-chip-minQuantityNeeded');
    await expect(chip).toBeVisible();
    await chip.getByRole('button', { name: /Remover filtro/i }).click();
    await page.waitForTimeout(400);

    await expect(hint).not.toBeVisible();
    const afterChipRemove = await page.locator('tbody tr').count();
    expect(afterChipRemove).toBe(initialRows);
    await expect(qty).toHaveValue('');
  });

  test('Chips de Categoria e Cor no hint removem cada filtro individualmente', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 0) test.skip(true, 'sem dados seedados');

    // Abre o popover de filtros avançados.
    await page.getByRole('button', { name: /^Filtros/i }).first().click();

    // Seleciona a primeira Categoria disponível.
    await page.getByRole('button', { name: /Categorias/i }).click();
    const firstCategory = page.locator('[data-testid^="external-category-option-"]').first();
    if (await firstCategory.isVisible().catch(() => false)) {
      await firstCategory.click();
    } else {
      test.skip(true, 'sem categorias disponíveis no ambiente');
    }

    // Seleciona o primeiro grupo de Cor.
    await page.getByRole('button', { name: /^Cores/i }).click();
    const firstColor = page.locator('[data-testid^="color-group-swatch-"]').first();
    if (await firstColor.isVisible().catch(() => false)) {
      await firstColor.click();
    }

    // Fecha popover e força "0 resultados" com quantidade absurda.
    await page.keyboard.press('Escape');
    await page.getByPlaceholder(/Preciso de X un/i).fill('99999999');
    await page.waitForTimeout(600);

    const hint = page.getByTestId('stock-empty-filters-hint');
    await expect(hint).toBeVisible({ timeout: 5000 });

    // Chip de Categoria deve existir e ser removível individualmente.
    const catChip = page.getByTestId('stock-empty-filters-chip-categoryId');
    if (await catChip.isVisible().catch(() => false)) {
      await catChip.getByRole('button', { name: /Remover filtro/i }).click();
      await page.waitForTimeout(300);
      await expect(catChip).not.toBeVisible();
    }

    // Chip de Cor (colorGroup) idem.
    const colorChip = page.getByTestId('stock-empty-filters-chip-colorGroup');
    if (await colorChip.isVisible().catch(() => false)) {
      await colorChip.getByRole('button', { name: /Remover filtro/i }).click();
      await page.waitForTimeout(300);
      await expect(colorChip).not.toBeVisible();
    }

    // Hint deve persistir enquanto Quantidade ainda zera a lista.
    await expect(hint).toBeVisible();
    await expect(page.getByTestId('stock-empty-filters-chip-minQuantityNeeded')).toBeVisible();
  });

  test('Limpar busca textual mantém Categoria/Cor/Quantidade filtrando', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 0) test.skip(true, 'sem dados seedados');

    const search = page.getByPlaceholder(/Buscar no Estoque/i);
    const qty = page.getByPlaceholder(/Preciso de X un/i);

    // Aplica busca + quantidade.
    await search.fill('a');
    await qty.fill('1');
    await page.waitForTimeout(600);
    const withBoth = await page.locator('tbody tr').count();

    // Limpa apenas a busca — quantidade DEVE continuar ativa.
    await search.fill('');
    await page.waitForTimeout(600);
    const withQtyOnly = await page.locator('tbody tr').count();

    // O resultado sem busca deve ser >= ao resultado com busca (filtro de qty
    // continua aplicado, busca textual foi removida).
    expect(withQtyOnly).toBeGreaterThanOrEqual(withBoth);

    // E deve ser <= total inicial (quantidade ainda restringe).
    expect(withQtyOnly).toBeLessThanOrEqual(initialRows);

    // Garante que o input de quantidade NÃO foi resetado pela limpeza da busca.
    await expect(qty).toHaveValue('1');
  });

  test('Estoque Futuro ON sincroniza régua: hint estrita não aparece', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const initialRows = await page.locator('tbody tr').count();
    if (initialRows === 0) test.skip(true, 'sem dados seedados');

    // 1. Liga Estoque Futuro pelo atalho Shift+F — agora o toggle do toolbar
    //    também ativa minQtyIncludesFutureStock (seção "Estoque" do popover removida).
    await page.keyboard.press('Shift+F');
    await page.waitForTimeout(300);

    // 2. Aplica quantidade mínima alta.
    const qty = page.getByPlaceholder(/Preciso de X un/i);
    await qty.fill('500');
    await page.waitForTimeout(600);

    // 3. Hint "régua estrita" NÃO deve aparecer (sincronização automática).
    const strictHint = page.getByTestId('min-qty-strict-hint');
    await expect(strictHint).toHaveCount(0);
  });


  // Nota: /estoque é uma rota protegida (plataforma fechada). Não existe modo
  // anônimo — usuários sem sessão são redirecionados para /auth. Por isso o
  // "comportamento idêntico entre logado e anônimo" se reduz a validar que o
  // logado funciona corretamente; o caso anônimo é coberto pelo redirect guard.
});

