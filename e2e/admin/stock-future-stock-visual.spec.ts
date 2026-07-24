/**
 * E2E — Regressão visual do botão "Estoque Futuro".
 *
 * Cobertura ampliada (10/10):
 *  - Larguras: 320, 375, 390, 414, 768, 820, 1280, 1536
 *  - Densidades: deviceScaleFactor 1 e 2 (Retina)
 *  - Estados: OFF + ON × {7, 15, 30} dias
 *
 * O baseline é parametrizado por viewport + DPR para flagrar regressões
 * sutis (kerning, sub-pixel, bordas) em telas HiDPI.
 *
 * Atualizar baselines:
 *   npx playwright test e2e/admin/stock-future-stock-visual.spec.ts --update-snapshots
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const STORAGE_KEY = 'stock-filter:future-stock-pref:v1';

const VIEWPORTS = [
  { name: 'xs-320', width: 320, height: 568 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-1536', width: 1536, height: 864 },
] as const;

const DPRS = [1, 2] as const;

const FREEZE_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
`;

async function settle(page: Page) {
  await page.addStyleTag({ content: FREEZE_CSS });
  await expect(page.locator(Sel.stock.futureStockToggleButton)).toBeVisible({ timeout: 15_000 });
}

async function setPref(
  page: Page,
  pref: { includeFutureStock: boolean; futureStockWindowDays: 7 | 15 | 30 },
) {
  await page.addInitScript(
    ({ k, v }) => {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    { k: STORAGE_KEY, v: pref },
  );
}

test.describe('Estoque Futuro — regressão visual do botão', () => {
  for (const vp of VIEWPORTS) {
    for (const dpr of DPRS) {
      test.describe(`${vp.name} @${dpr}x`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: dpr });

        test('estado OFF (apenas em estoque)', async ({ page }) => {
          await setPref(page, { includeFutureStock: false, futureStockWindowDays: 15 });
          await loginAs(page);
          await gotoAndSettle(page, '/estoque');
          await settle(page);
          const btn = page.locator(Sel.stock.futureStockToggleButton);
          await expect(btn).toHaveAttribute('aria-pressed', 'false');
          await expect(btn).toHaveScreenshot(
            `future-stock-button-off-${vp.name}-${dpr}x.png`,
            { maxDiffPixelRatio: 0.02 },
          );
        });

        for (const days of [7, 15, 30] as const) {
          test(`estado ON janela ${days}d`, async ({ page }) => {
            await setPref(page, { includeFutureStock: true, futureStockWindowDays: days });
            await loginAs(page);
            await gotoAndSettle(page, '/estoque');
            await settle(page);
            const btn = page.locator(Sel.stock.futureStockToggleButton);
            await expect(btn).toHaveAttribute('aria-pressed', 'true');
            await expect(btn).toContainText(`${days}d`);
            await expect(btn).toHaveScreenshot(
              `future-stock-button-on-${days}d-${vp.name}-${dpr}x.png`,
              { maxDiffPixelRatio: 0.02 },
            );
          });
        }
      });
    }
  }
});
