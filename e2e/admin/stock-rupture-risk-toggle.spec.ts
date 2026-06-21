/**
 * E2E — Toggle "Risco de Ruptura" no toolbar do /estoque.
 *
 * Espelha 1-para-1 o spec de Estoque Futuro (stock-future-stock.spec.ts):
 *  - Botão dedicado existe fora do popover de filtros.
 *  - Alternar liga o Switch e exibe o badge "Nd" no botão.
 *  - Trocar o horizonte (3/7/15/30) atualiza `aria-checked` e o badge.
 *  - A ativação é persistida em `localStorage` (`stock-filter:rupture-risk-active:v1`)
 *    + horizonte em `stock.ruptureHorizon`; ambos sobrevivem a um reload.
 *  - Quando não há SKUs em risco, o Switch fica desabilitado (sem badge).
 *
 * Política: usa exclusivamente seletores do SSOT (`Sel.stock.*`).
 */
import { test, expect } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const ACTIVE_KEY = 'stock-filter:rupture-risk-active:v1';
const HORIZON_KEY = 'stock.ruptureHorizon';

async function readStorage(page: Page, key: string) {
  return page.evaluate((k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  }, key);
}

test.describe('Estoque — toggle Risco de Ruptura (paridade com Estoque Futuro)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ a, h }) => {
        try {
          window.localStorage.removeItem(a);
          window.localStorage.removeItem(h);
        } catch {
          /* ignore */
        }
      },
      { a: ACTIVE_KEY, h: HORIZON_KEY },
    );
    await loginAs(page);
    await gotoAndSettle(page, '/estoque');
  });

  test('liga, troca horizonte, persiste e sobrevive a reload', async ({ page }) => {
    const toggle = page.locator(Sel.stock.ruptureRiskToggleButton);
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Badge oculto enquanto o filtro está OFF.
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toHaveCount(0);

    // Abre o popover e liga o Switch.
    await toggle.click();
    const sw = page.locator(Sel.stock.ruptureRiskSwitch);
    await expect(sw).toBeVisible();
    if (await sw.isDisabled()) {
      test.skip(true, 'sem SKUs em risco para validar o toggle');
    }
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    // Horizonte default = 3d.
    await expect(page.locator(Sel.stock.ruptureRiskHorizon(3))).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Troca para 30 dias.
    await page.locator(Sel.stock.ruptureRiskHorizon(30)).click();
    await expect(page.locator(Sel.stock.ruptureRiskHorizon(30))).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // Fecha popover e valida estado do botão + badge.
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('30d');
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toBeVisible();

    // Persistência no localStorage.
    await expect.poll(() => readStorage(page, ACTIVE_KEY)).toBe('1');
    await expect.poll(() => readStorage(page, HORIZON_KEY)).toBe('30');

    // Sobrevive a reload (re-hidratação do filtro quando alertas EMA chegam).
    await page.reload();
    const toggleAfter = page.locator(Sel.stock.ruptureRiskToggleButton);
    await expect(toggleAfter).toBeVisible({ timeout: 15_000 });
    await expect(toggleAfter).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await expect(toggleAfter).toContainText('30d');
  });

  test('desligar via Switch remove o badge e zera a pref', async ({ page }) => {
    const toggle = page.locator(Sel.stock.ruptureRiskToggleButton);
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    await toggle.click();
    const sw = page.locator(Sel.stock.ruptureRiskSwitch);
    if (await sw.isDisabled()) {
      test.skip(true, 'sem SKUs em risco para validar o toggle');
    }

    // Liga e depois desliga.
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toHaveCount(0);
    await expect.poll(() => readStorage(page, ACTIVE_KEY)).toBe('0');
  });
});
