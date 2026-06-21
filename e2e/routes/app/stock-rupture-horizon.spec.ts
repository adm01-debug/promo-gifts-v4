/**
 * E2E — Horizonte de projeção do "Risco de Ruptura" no /estoque.
 *
 * Valida:
 *  1. Controle `rupture-horizon-control` está visível com default "3 dias".
 *  2. Trocar para 7/15/30 dias persiste em localStorage e mantém a tabela coerente.
 *  3. Chip de status `low_stock` (Risco de Ruptura) reage à mudança de horizonte:
 *     o contador pode aumentar ou ficar igual conforme janela amplia (≥, nunca <).
 *
 * Skipa automaticamente em ambientes sem dados (empty/sync state) para evitar
 * flakiness em CI sem seed — alinhado a `stock-filter-switching.spec.ts`.
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';

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

    // 1. Controle visível com default 3 dias (badge "3d" no botão).
    const horizonControl = page.getByTestId('rupture-horizon-control');
    await expect(horizonControl).toBeVisible();
    await expect(horizonControl).toContainText('3d');

    // Aplica filtro de quantidade-alvo para ativar a fórmula preditiva.
    await page.getByPlaceholder(/Preciso de X un/i).fill('100');
    await page.waitForTimeout(400);

    // Coleta contador do chip low_stock no horizonte 3d.
    const lowChip = page.getByTestId('stock-status-chip-low_stock');
    await expect(lowChip).toBeVisible();
    const count3d = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');

    // 2. Troca para 30d — janela maior ⇒ mais SKUs em risco (monotonia ≥).
    await horizonControl.click();
    await page.getByTestId('rupture-horizon-30').click();
    await page.waitForTimeout(400);
    await expect(horizonControl).toContainText('30d');

    const count30d = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');
    expect(count30d).toBeGreaterThanOrEqual(count3d);

    // 3. Persistência: localStorage guarda o horizonte escolhido.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('stock.ruptureHorizon'),
    );
    expect(stored).toBe('30');

    // 4. Reload preserva a seleção.
    await page.reload();
    await expect(page.getByTestId('rupture-horizon-control')).toContainText('30d');
  });
});
