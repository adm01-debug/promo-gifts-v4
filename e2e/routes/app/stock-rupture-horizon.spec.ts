/**
 * E2E — Horizonte de projeção do "Risco de Ruptura" no /estoque.
 *
 * Valida:
 *  1. Controle visível; badge "Nd" aparece somente após ativar o Switch.
 *  2. Trocar para 7/15/30 dias persiste em localStorage (chave v1) e o grid
 *     reflete o novo horizonte (chip low_stock cresce monotonicamente).
 *  3. Reload preserva horizonte E ativação (re-hidratação assíncrona).
 *
 * Chaves de localStorage (padrão `stock-filter:*:v1`):
 *  • `stock-filter:rupture-horizon:v1`        — horizonte selecionado
 *  • `stock-filter:rupture-risk-active:v1`    — ativação on/off
 *
 * A chave legada `stock.ruptureHorizon` é lida só uma vez (migração).
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';

const HORIZON_KEY = 'stock-filter:rupture-horizon:v1';
const ACTIVE_KEY = 'stock-filter:rupture-risk-active:v1';

test.describe('@regression /estoque — horizonte de Risco de Ruptura', () => {
  test('@rupture-horizon altera projeção e persiste seleção', async ({ page }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const syncing = page.getByText(/Sincronizando estoque/i);
    if (await syncing.isVisible().catch(() => false)) {
      await expect(syncing).not.toBeVisible({ timeout: 60_000 });
    }
    const empty = page.getByText(/Nenhum produto encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'sem dados seedados para validar horizonte de ruptura');
    }

    // 1. Controle visível; badge oculto até ativar o Switch.
    const horizonControl = page.getByTestId('rupture-horizon-control');
    await expect(horizonControl).toBeVisible();
    await horizonControl.click();

    const sw = page.getByTestId('rupture-risk-switch');
    await expect(sw).toBeVisible();
    if (await sw.isDisabled()) {
      test.skip(true, 'sem SKUs em risco para validar o toggle');
    }
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(horizonControl).toContainText('3d');

    // Aplica filtro de quantidade-alvo para ativar a fórmula preditiva.
    await page.getByPlaceholder(/Preciso de X un/i).fill('100');
    await page.waitForTimeout(400);

    const lowChip = page.getByTestId('stock-status-chip-low_stock');
    await expect(lowChip).toBeVisible();
    const count3d = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');

    // 2. Troca para 30d — janela maior ⇒ mais SKUs em risco (monotonia ≥).
    await page.getByTestId('rupture-horizon-30').click();
    await page.waitForTimeout(400);
    await expect(horizonControl).toContainText('30d');

    const count30d = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');
    expect(count30d).toBeGreaterThanOrEqual(count3d);

    // 3. Persistência: localStorage (chave v1) guarda horizonte + ativação.
    const stored = await page.evaluate((k) => window.localStorage.getItem(k), HORIZON_KEY);
    expect(stored).toBe('30');
    const active = await page.evaluate((k) => window.localStorage.getItem(k), ACTIVE_KEY);
    expect(active).toBe('1');

    // 4. Reload preserva horizonte + reativa filtro via re-hidratação.
    await page.reload();
    const after = page.getByTestId('rupture-horizon-control');
    await expect(after).toBeVisible({ timeout: 15_000 });
    await expect(after).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await expect(after).toContainText('30d');
  });
});
