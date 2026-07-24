/**
 * E2E: query textual (`q`) com debounce de 250ms em /carrinhos.
 *
 * Contrato validado:
 *  - Deep-link `?q=texto` restaura o valor no input de busca imediatamente
 *    após hidratação (sem esperar debounce).
 *  - Após reload, o valor `q` persiste na URL e no input.
 *  - Digitar no input NÃO grava `q` na URL antes de ~250ms de idle: a URL
 *    permanece sem o parâmetro até o debounce disparar.
 *  - Após ~350ms de idle a URL passa a refletir o valor digitado.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · debounce da busca e reload @smoke', () => {
  test('deep-link ?q=abc restaura o input e sobrevive ao reload', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos?q=abc');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const input = page.getByTestId('carts-list-search');
    await expect(input).toHaveValue('abc');

    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page).toHaveURL(/q=abc/);
    await expect(page.getByTestId('carts-list-search')).toHaveValue('abc');
  });

  test('digitação não polui a URL antes do debounce (~250ms)', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    const input = page.getByTestId('carts-list-search');
    await input.fill('xy');

    // Snapshot imediato: URL ainda não deve conter q=xy antes do debounce.
    // Aceita a janela [0, 200ms] como "pre-debounce" para reduzir flakiness em CI.
    await page.waitForTimeout(150);
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();

    // Após >250ms de idle, o debounce dispara e a URL passa a refletir.
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 2_000 })
      .toBe('xy');
  });

  test('reload após debounce mantém input, URL e lista renderizada', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();

    await page.getByTestId('carts-list-search').fill('teste-debounce');
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 2_000 })
      .toBe('teste-debounce');

    await page.reload();
    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page).toHaveURL(/q=teste-debounce/);
    await expect(page.getByTestId('carts-list-search')).toHaveValue('teste-debounce');
  });
});
