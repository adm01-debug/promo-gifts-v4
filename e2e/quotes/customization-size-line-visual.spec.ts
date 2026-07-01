/**
 * Visual regression do cabeçalho de ConfigurationPanelV6 em 360px e 768px.
 *
 * Captura screenshot do container que envolve a linha "Tamanho da gravação"
 * (cabeçalho do painel + primeira linha responsiva) para detectar quebras
 * futuras do layout. Baselines são geradas via `--update-snapshots` no
 * workflow dedicado.
 *
 * Estratégia oportunística: skipa se não houver painel com dimensão no
 * ambiente (mesmo padrão do quote-engraving-header.spec.ts).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoQuoteScenario } from './_helpers/quote-scenarios';

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'tablet-768', width: 768, height: 1024 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`ConfigurationPanelV6 — snapshot visual do cabeçalho (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`baseline visual da linha "Tamanho da gravação" (${vp.width}px)`, async ({ page }) => {
      await loginAs(page);
      const ok = await gotoQuoteScenario(page, 'rascunho');
      test.skip(!ok, 'sem orçamento em rascunho neste ambiente');

      const label = page.getByText('Tamanho da gravação', { exact: true }).first();
      const count = await label.count().catch(() => 0);
      test.skip(count === 0, 'painel de customização com dimensão não disponível');

      await label.waitFor({ state: 'visible', timeout: 10_000 });
      const row = label.locator('xpath=..');

      // Estabiliza animações antes do screenshot para reduzir flakes.
      await page.addStyleTag({
        content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`,
      });

      await expect(row).toHaveScreenshot(`size-line-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}
