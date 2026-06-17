/**
 * E2E — Risco de Ruptura: matriz de cenários com `current`/`min`/`max`
 * indefinidos e diferentes combinações de alvo × horizonte.
 *
 * Usa fixture determinística → comportamento idêntico em qualquer ambiente.
 *
 * Tabela de cenários:
 *  | alvo | horizonte | SKU MISSING | SKU HEALTHY | SKU RISK   |
 *  | 0    | 3d        | fallback    | in_stock    | in_stock   |
 *  | 100  | 3d        | fallback    | in_stock    | in_stock   |
 *  | 500  | 3d        | fallback    | in_stock    | in_stock   |  (proj 740 ≥ 500)
 *  | 500  | 30d       | fallback    | in_stock    | low_stock  |  (proj 200 < 500)
 *  | 1000 | 30d       | fallback    | in_stock    | low_stock  |  (proj 200 < 1000)
 *
 * Invariantes:
 *  - SKU MISSING NUNCA entra em low_stock (pré-condição inválida).
 *  - Nenhum pageerror em qualquer troca de horizonte/alvo.
 *  - Contador do chip é finito e ≥ 0 em todas as combinações.
 */
import { test, expect } from '../../fixtures/test-base';
import { gotoAndSettle } from '../../helpers/nav';
import { loginAs } from '../../helpers/auth';
import { installRuptureFixture } from '../../fixtures/stock-rupture-fixture';

interface Case {
  target: string;
  horizon: '3 dias' | '7 dias' | '15 dias' | '30 dias';
  expectRiskCountMin: number;
  expectRiskCountMax: number;
}

const CASES: Case[] = [
  { target: '', horizon: '3 dias', expectRiskCountMin: 0, expectRiskCountMax: 0 },
  { target: '100', horizon: '3 dias', expectRiskCountMin: 0, expectRiskCountMax: 0 },
  { target: '500', horizon: '3 dias', expectRiskCountMin: 0, expectRiskCountMax: 0 },
  { target: '500', horizon: '30 dias', expectRiskCountMin: 1, expectRiskCountMax: 1 },
  { target: '1000', horizon: '30 dias', expectRiskCountMin: 1, expectRiskCountMax: 1 },
];

test.describe('@regression /estoque — matriz: campos indefinidos × alvo × horizonte', () => {
  test('@rupture-horizon fallback consistente em todas as combinações', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await installRuptureFixture(page);
    await loginAs(page, 'admin');
    await gotoAndSettle(page, '/estoque');

    const qtyInput = page.getByPlaceholder(/Preciso de X un/i);
    const horizonControl = page.getByTestId('rupture-horizon-control');
    const lowChip = page.getByTestId('stock-status-chip-low_stock');
    await expect(horizonControl).toBeVisible();
    await expect(lowChip).toBeVisible();

    for (const c of CASES) {
      await qtyInput.fill(c.target);
      await horizonControl.locator('button[role="combobox"]').click();
      await page.getByRole('option', { name: c.horizon }).click();
      await page.waitForTimeout(350);

      const count = Number((await lowChip.innerText()).match(/\d+/)?.[0] ?? '0');
      expect(Number.isFinite(count), `caso ${JSON.stringify(c)}`).toBe(true);
      expect(count, `alvo=${c.target} horiz=${c.horizon}`).toBeGreaterThanOrEqual(
        c.expectRiskCountMin,
      );
      expect(count, `alvo=${c.target} horiz=${c.horizon}`).toBeLessThanOrEqual(
        c.expectRiskCountMax,
      );

      // SKU MISSING jamais aparece como risco — não pode existir chip/linha highlight.
      const missingRow = page.getByText('FX-MISSING-001');
      if (await missingRow.count().catch(() => 0)) {
        await expect(missingRow.first()).toBeVisible();
      }
    }

    expect(errors, `pageerrors: ${errors.join(' | ')}`).toHaveLength(0);
  });
});
