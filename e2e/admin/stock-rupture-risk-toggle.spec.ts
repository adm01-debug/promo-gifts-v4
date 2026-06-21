/**
 * E2E — Toggle "Risco de Ruptura" no toolbar do /estoque.
 *
 * Espelha 1-para-1 o spec de Estoque Futuro: liga, troca horizonte (que
 * agora filtra o grid + atualiza badge juntos), persiste em localStorage
 * (chaves v1) e sobrevive a reload via re-hidratação dos alertas EMA.
 */
import { test, expect } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const ACTIVE_KEY = 'stock-filter:rupture-risk-active:v1';
const HORIZON_KEY = 'stock-filter:rupture-horizon:v1';

async function read(page: Page, key: string) {
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
          window.localStorage.removeItem('stock.ruptureHorizon');
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
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toHaveCount(0);

    await toggle.click();
    const sw = page.locator(Sel.stock.ruptureRiskSwitch);
    await expect(sw).toBeVisible();
    if (await sw.isDisabled()) {
      test.skip(true, 'sem SKUs em risco para validar o toggle');
    }
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(Sel.stock.ruptureRiskHorizon(3))).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.locator(Sel.stock.ruptureRiskHorizon(30)).click();
    await expect(page.locator(Sel.stock.ruptureRiskHorizon(30))).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('30d');
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toBeVisible();

    await expect.poll(() => read(page, ACTIVE_KEY)).toBe('1');
    await expect.poll(() => read(page, HORIZON_KEY)).toBe('30');

    await page.reload();
    const after = page.locator(Sel.stock.ruptureRiskToggleButton);
    await expect(after).toBeVisible({ timeout: 15_000 });
    await expect(after).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await expect(after).toContainText('30d');
  });

  test('desligar via Switch remove o badge e zera a pref', async ({ page }) => {
    const toggle = page.locator(Sel.stock.ruptureRiskToggleButton);
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    await toggle.click();
    const sw = page.locator(Sel.stock.ruptureRiskSwitch);
    if (await sw.isDisabled()) {
      test.skip(true, 'sem SKUs em risco para validar o toggle');
    }
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(Sel.stock.ruptureRiskHorizonBadge)).toHaveCount(0);
    await expect.poll(() => read(page, ACTIVE_KEY)).toBe('0');
  });
});
