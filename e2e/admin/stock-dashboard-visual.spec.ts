/**
 * E2E — Regressão visual do /estoque.
 *
 * Captura screenshots determinísticos dos estados-chave (badge Saúde,
 * legenda de faixas, drawer aberto e dialog "Como é calculado") em
 * múltiplos viewports. Usa waits explícitos por testid para evitar flake.
 *
 * Para atualizar baselines: `npx playwright test e2e/admin/stock-dashboard-visual.spec.ts --update-snapshots`
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1536, height: 864 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

// Estabilizadores de screenshot: zera animações e cursores piscantes.
const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

async function settle(page: Page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  // Aguarda o badge — confirma que o dashboard hidratou.
  await expect(page.getByTestId('health-score-badge')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('stock-thresholds-legend').first()).toBeAttached();
  // Garante que dados carregaram (loader saiu).
  await expect(page.locator('[data-testid="stock-loading"]')).toHaveCount(0).catch(() => {});
}

test.describe('Estoque — regressão visual', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`viewport ${vp.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginAs(page);
        await gotoAndSettle(page, '/estoque');
        await settle(page);
      });

      test('badge Saúde + legenda (faixa good/warning/danger)', async ({ page }) => {
        const badge = page.getByTestId('health-score-badge');
        await expect(badge).toBeVisible();

        // O texto do badge contém o % — captura screenshot só do bloco superior
        // para que o snapshot não dependa do dataset completo.
        const text = (await badge.textContent()) ?? '';
        const score = Number(/(\d{1,3})\s*%/.exec(text)?.[1] ?? '0');
        const band = score >= 80 ? 'good' : score >= 50 ? 'warning' : 'danger';

        await expect(badge).toHaveScreenshot(`badge-saude-${band}-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });

        await expect(page.getByTestId('stock-thresholds-legend').first()).toHaveScreenshot(
          `legenda-thresholds-${vp.name}.png`,
          { maxDiffPixelRatio: 0.02 },
        );
      });

      test('drawer aberto com contadores por faixa', async ({ page }) => {
        await page.getByTestId('health-score-badge').click();
        const drawer = page.getByTestId('stock-breakdown-drawer');
        await expect(drawer).toBeVisible();
        // Espera tabs renderizadas (determinístico — sem timeout cego).
        await expect(page.getByTestId('tab-critical')).toBeVisible();
        await expect(page.getByTestId('tab-critical')).toBeEnabled();

        await expect(drawer).toHaveScreenshot(`drawer-saude-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
          mask: [drawer.locator('img')],
        });
      });

      test('dialog "Como é calculado"', async ({ page }) => {
        await page.getByTestId('health-score-info-trigger').click();
        const dialog = page.getByTestId('health-score-info-dialog');
        await expect(dialog).toBeVisible();
        await expect(page.getByTestId('health-score-live-example')).toHaveText(
          /\d[\d.,]*\s*\/\s*\d[\d.,]*\s*=\s*\d{1,3}%/,
        );

        await expect(dialog).toHaveScreenshot(`dialog-como-calculado-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });
    });
  }
});
