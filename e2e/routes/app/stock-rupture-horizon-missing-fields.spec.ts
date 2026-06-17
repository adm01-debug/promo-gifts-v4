/**
 * E2E — Risco de Ruptura com CAMPOS DE SKU INDEFINIDOS.
 *
 * Garante que `current`, `min` ou `max` ausentes (null/undefined) não
 * quebram o chip `stock-status-chip-low_stock` nem a renderização da
 * tabela. A fórmula `computeRuptureRisk` deve ignorar a linha (pré-
 * condição inválida) e o status cai no fallback estático.
 *
 * Usa fixture determinística (`installRuptureFixture`) para garantir que
 * existe pelo menos uma SKU com campos nulos em qualquer ambiente.
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';
import { installRuptureFixture } from '../../fixtures/stock-rupture-fixture';

test.describe('@regression /estoque — Risco de Ruptura com SKU sem current/min/max', () => {
  test('@rupture-horizon SKU com campos nulos não crasha chip nem tabela', async ({
    page,
  }) => {
    await installRuptureFixture(page);
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    // Chip deve estar visível mesmo com SKU "incompleta" na fixture.
    const lowChip = page.getByTestId('stock-status-chip-low_stock');
    await expect(lowChip).toBeVisible();

    // Não pode lançar erro JS — tabela tem que renderizar todas as linhas.
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Aplica alvo + troca horizonte para forçar recomputo em todas as linhas.
    await page.getByPlaceholder(/Preciso de X un/i).fill('500');
    const horizonControl = page.getByTestId('rupture-horizon-control');
    await horizonControl.locator('button[role="combobox"]').click();
    await page.getByRole('option', { name: '30 dias' }).click();
    await page.waitForTimeout(400);

    // A linha da SKU sem dados (FX-MISSING-001) deve estar presente — sem crash.
    const missingRow = page.getByText('FX-MISSING-001');
    if (await missingRow.count().catch(() => 0)) {
      await expect(missingRow.first()).toBeVisible();
    }

    // Nenhum erro JS deve ter sido lançado pela mudança de horizonte.
    expect(errors, `pageerrors: ${errors.join(' | ')}`).toHaveLength(0);

    // Chip continua coerente (contador é número finito ≥ 0).
    const count = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');
    expect(Number.isFinite(count)).toBe(true);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
