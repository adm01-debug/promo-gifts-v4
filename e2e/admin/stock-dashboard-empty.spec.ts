/**
 * E2E — Estado vazio do /estoque.
 *
 * Mocka o bridge externo para devolver `rows: []` e valida:
 * - badge Saúde renderiza 100% (faixa good — não há nada a alertar)
 * - dialog "Como é calculado" mostra "0 / 0 = 100%"
 * - drawer abre e cada tab mostra empty state determinístico
 */
import { test, expect } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Estoque — estado vazio (sem registros)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercepta a edge que alimenta o dashboard ANTES do login + navegação.
    await page.route('**/functions/v1/external-db-bridge*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ rows: [], data: [], count: 0 }),
      });
    });

    await loginAs(page);
    await gotoAndSettle(page, '/estoque');
  });

  test('badge Saúde mostra 100% (faixa good) sem produtos', async ({ page }) => {
    const badge = page.getByTestId('health-score-badge');
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toHaveText(/Saúde:\s*100\s*%/);
  });

  test('dialog "Como é calculado" mostra 0 / 0 = 100%', async ({ page }) => {
    await page.getByTestId('health-score-info-trigger').click();
    const dialog = page.getByTestId('health-score-info-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('health-score-live-example')).toHaveText(/0\s*\/\s*0\s*=\s*100\s*%/);
  });

  test('drawer abre e tab "Crítico" exibe empty state', async ({ page }) => {
    await page.getByTestId('health-score-badge').click();
    const drawer = page.getByTestId('stock-breakdown-drawer');
    await expect(drawer).toBeVisible();

    await page.getByTestId('tab-critical').click();
    await expect(page.getByTestId('tab-critical')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId('stock-breakdown-empty')).toBeVisible();
  });
});
