/**
 * E2E: /orcamentos restaura filtros, ordenação e busca (com debounce 250ms)
 * da query string após recarregar a página.
 *
 * Contrato validado (paridade com /carrinhos):
 *  - Deep-link `?status=approved&sort=highest&q=abc` reflete nos controles.
 *  - Reload preserva URL e valores.
 *  - Defaults (`status=all`, `sort=newest`, `q=""`) são removidos da URL.
 *  - Digitação não polui a URL antes de ~250ms de idle.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Orçamentos · restauração de filtros via URL @smoke', () => {
  test('deep-link com status, sort e q restaura selects e input', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos?status=approved&sort=highest&q=abc');
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();

    await expect(page.getByTestId('quotes-search-input')).toHaveValue('abc');
    await expect(page.getByTestId('quotes-sort-trigger')).toContainText(/Maior valor/i);
  });

  test('reload preserva filtros, ordenação e busca', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos?status=draft&sort=oldest&q=teste');
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();

    await expect(page.getByTestId('quotes-search-input')).toHaveValue('teste');
    await expect(page.getByTestId('quotes-sort-trigger')).toContainText(/Mais antigos/i);

    await page.reload();
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();
    await expect(page).toHaveURL(/status=draft/);
    await expect(page).toHaveURL(/sort=oldest/);
    await expect(page).toHaveURL(/q=teste/);
    await expect(page.getByTestId('quotes-search-input')).toHaveValue('teste');
    await expect(page.getByTestId('quotes-sort-trigger')).toContainText(/Mais antigos/i);
  });

  test('valores default são removidos da URL após hidratação', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos?status=all&sort=newest&q=');
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('status'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('sort'), { timeout: 3_000 })
      .toBeNull();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 3_000 })
      .toBeNull();
  });

  test('digitação não polui a URL antes do debounce (~250ms)', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/orcamentos');
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();

    const input = page.getByTestId('quotes-search-input');
    await input.fill('xy');
    await page.waitForTimeout(150);
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();

    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'), { timeout: 2_000 })
      .toBe('xy');

    await page.reload();
    await expect(page.getByTestId('page-title-orcamentos')).toBeVisible();
    await expect(page).toHaveURL(/q=xy/);
    await expect(page.getByTestId('quotes-search-input')).toHaveValue('xy');
  });
});
