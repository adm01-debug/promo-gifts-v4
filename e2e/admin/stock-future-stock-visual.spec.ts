/**
 * E2E — Regressão visual do botão "Estoque Futuro".
 *
 * Captura o botão dedicado (estados off/on com janela 7/15/30) em desktop,
 * tablet e mobile para garantir que o layout permaneça discreto e elegante
 * em todos os breakpoints. Anima/transição zerados para snapshot estável.
 *
 * Atualizar baselines:
 *   npx playwright test e2e/admin/stock-future-stock-visual.spec.ts --update-snapshots
 */
import { test, expect } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const STORAGE_KEY = 'stock-filter:future-stock-pref:v1';

const VIEWPORTS = [
  { name: 'desktop', width: 1536, height: 864 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

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

async function setPref(page: Page, pref: { includeFutureStock: boolean; futureStockWindowDays: 7 | 15 | 30 }) {
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
    test.describe(`viewport ${vp.name}`, () => {
      test('estado OFF (apenas em estoque)', async ({ page }) => {
        await setPref(page, { includeFutureStock: false, futureStockWindowDays: 15 });
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginAs(page);
        await gotoAndSettle(page, '/estoque');
        await settle(page);
        const btn = page.locator(Sel.stock.futureStockToggleButton);
        await expect(btn).toHaveAttribute('aria-pressed', 'false');
        await expect(btn).toHaveScreenshot(`future-stock-button-off-${vp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        });
      });

      for (const days of [7, 15, 30] as const) {
        test(`estado ON janela ${days}d`, async ({ page }) => {
          await setPref(page, { includeFutureStock: true, futureStockWindowDays: days });
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await loginAs(page);
          await gotoAndSettle(page, '/estoque');
          await settle(page);
          const btn = page.locator(Sel.stock.futureStockToggleButton);
          await expect(btn).toHaveAttribute('aria-pressed', 'true');
          await expect(btn).toContainText(`${days}d`);
          await expect(btn).toHaveScreenshot(
            `future-stock-button-on-${days}d-${vp.name}.png`,
            { maxDiffPixelRatio: 0.02 },
          );
        });
      }
    });
  }
});
