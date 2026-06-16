/**
 * E2E — Acessibilidade (axe-core) do botão "Estoque Futuro".
 *
 * Verifica que nem o botão dedicado nem o popover (com switch + pílulas de
 * janela) introduzem violações de ARIA, contraste ou nomes acessíveis.
 *
 * Escopo restrito ao componente (.include) para não ser ofuscado por
 * violações pré-existentes em outras áreas do /estoque.
 */
import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const STORAGE_KEY = 'stock-filter:future-stock-pref:v1';

const RULESET = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
];

test.describe('Estoque Futuro — a11y (axe-core)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }, STORAGE_KEY);
    await loginAs(page);
    await gotoAndSettle(page, '/estoque');
  });

  test('botão fechado (OFF) não tem violações', async ({ page }) => {
    const btn = page.locator(Sel.stock.futureStockToggleButton);
    await expect(btn).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include(Sel.stock.futureStockToggleButton)
      .withTags(RULESET)
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('popover aberto (switch + pílulas) não tem violações', async ({ page }) => {
    const btn = page.locator(Sel.stock.futureStockToggleButton);
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    const sw = page.locator(Sel.stock.futureStockSwitch);
    await expect(sw).toBeVisible();
    // Liga para renderizar o radiogroup das janelas.
    await sw.click();
    await expect(page.locator(Sel.stock.futureStockWindow(15))).toBeVisible();

    // Roda no <body> mas exclui o resto do dashboard — foca no popover + botão.
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"], [data-radix-popper-content-wrapper]')
      .withTags(RULESET)
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
