/**
 * E2E — Toggle "Estoque Futuro" no toolbar do /estoque.
 *
 * Valida:
 *  - O botão dedicado existe fora do popover de filtros.
 *  - Alternar liga o switch e exibe a janela padrão (15d).
 *  - Trocar a janela (7/15/30) atualiza `aria-checked` e o badge "Nd" do botão.
 *  - A preferência é persistida em `localStorage` na chave SSOT
 *    `stock-filter:future-stock-pref:v1` e sobrevive a um reload da página.
 *  - O atalho Shift+F alterna o estado.
 *
 * Política: usa exclusivamente seletores do SSOT (`Sel.stock.*`).
 */
import { test, expect } from '../fixtures/test-base';
import type { Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const STORAGE_KEY = 'stock-filter:future-stock-pref:v1';

async function readPref(page: Page) {
  return page.evaluate(
    (k) => {
      try {
        const raw = window.localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    STORAGE_KEY,
  );
}

test.describe('Estoque — toggle Estoque Futuro', () => {
  test.beforeEach(async ({ page }) => {
    // Pré-limpa preferência para garantir estado determinístico antes do load.
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

  test('liga, troca janela, persiste em localStorage e sobrevive a reload', async ({ page }) => {
    const toggle = page.locator(Sel.stock.futureStockToggleButton);
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Abre o popover e liga o switch.
    await toggle.click();
    const sw = page.locator(Sel.stock.futureStockSwitch);
    await expect(sw).toBeVisible();
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');

    // Janela padrão (15d) deve estar marcada.
    const w15 = page.locator(Sel.stock.futureStockWindow(15));
    await expect(w15).toHaveAttribute('aria-checked', 'true');

    // Troca para 30 dias.
    await page.locator(Sel.stock.futureStockWindow(30)).click();
    await expect(page.locator(Sel.stock.futureStockWindow(30))).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(w15).toHaveAttribute('aria-checked', 'false');

    // Fecha popover (Escape) e valida estado do botão.
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('30d');

    // Persistência no localStorage.
    await expect.poll(() => readPref(page)).toEqual({
      includeFutureStock: true,
      futureStockWindowDays: 30,
    });

    // Sobrevive a reload.
    await page.reload();
    const toggleAfter = page.locator(Sel.stock.futureStockToggleButton);
    await expect(toggleAfter).toBeVisible({ timeout: 15_000 });
    await expect(toggleAfter).toHaveAttribute('aria-pressed', 'true');
    await expect(toggleAfter).toContainText('30d');
  });

  test('atalho Shift+F alterna inclusão do Estoque Futuro', async ({ page }) => {
    const toggle = page.locator(Sel.stock.futureStockToggleButton);
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Garante que o foco não está em input antes do atalho.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Shift+F');

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => readPref(page)).toMatchObject({ includeFutureStock: true });

    await page.keyboard.press('Shift+F');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
