/**
 * E2E — Risco de Ruptura com DADOS AUSENTES.
 *
 * Garante o fallback documentado em `src/lib/inventory/rupture-risk.ts`:
 * quando `avgDailyDepletion`, `targetQty` ou `horizonDays` não são válidos,
 * a fórmula NÃO se aplica (`atRisk = false`) e o status volta ao comportamento
 * estático anterior (≤ min). UI deve permanecer consistente — sem falsos
 * positivos e sem quebra visual.
 *
 * Casos cobertos:
 *  1. Sem `targetQty` (filtro "Preciso de X un" vazio) → contador low_stock
 *     do horizonte 30d == 3d (a fórmula não roda; só vale a regra estática).
 *  2. Trocar horizonte sem alvo não muda contagem (idempotente).
 *  3. Tabela continua renderizando linhas (não crasha por dados faltantes).
 *
 * Skipa em ambientes sem seed (igual `stock-rupture-horizon.spec.ts`).
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';

test.describe('@regression /estoque — Risco de Ruptura com dados ausentes', () => {
  test('@rupture-horizon sem alvo: horizonte não altera contagem (fallback estático)', async ({
    page,
  }) => {
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const syncing = page.getByText(/Sincronizando estoque/i);
    if (await syncing.isVisible().catch(() => false)) {
      await expect(syncing).not.toBeVisible({ timeout: 60_000 });
    }
    const empty = page.getByText(/Nenhum produto encontrado/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, 'sem dados seedados para validar fallback de ruptura');
    }

    // Garante alvo vazio — pré-condição inválida da fórmula.
    const qtyInput = page.getByPlaceholder(/Preciso de X un/i);
    await qtyInput.fill('');
    await page.waitForTimeout(300);

    const horizonControl = page.getByTestId('rupture-horizon-control');
    await expect(horizonControl).toBeVisible();

    const lowChip = page.getByTestId('stock-status-chip-low_stock');
    await expect(lowChip).toBeVisible();
    const readCount = async () =>
      Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');

    const baseline = await readCount();

    // Troca para 30d sem alvo — fórmula deve NÃO acionar (atRisk=false).
    await horizonControl.locator('button[role="combobox"]').click();
    await page.getByRole('option', { name: '30 dias' }).click();
    await page.waitForTimeout(300);
    expect(await readCount()).toBe(baseline);

    // Troca para 7d sem alvo — idem.
    await horizonControl.locator('button[role="combobox"]').click();
    await page.getByRole('option', { name: '7 dias' }).click();
    await page.waitForTimeout(300);
    expect(await readCount()).toBe(baseline);

    // 3. Tabela permanece funcional (≥ 1 linha renderizada).
    const rows = page.locator('[data-testid^="stock-row-"]');
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
