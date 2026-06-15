/**
 * Smoke E2E: customização de tabela do carrinho.
 * Valida apenas que o popover/preferências carregam e persistem em localStorage —
 * sem depender de dados reais (que requerem auth + dados de empresa).
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · personalização de tabela @smoke', () => {
  test('persiste view-mode, colunas e densidade no localStorage', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    // Define preferências diretamente no storage e recarrega
    await page.evaluate(() => {
      localStorage.setItem('cart-view-mode', 'table');
      localStorage.setItem(
        'cart-table-columns',
        JSON.stringify({
          color: false,
          quantity: true,
          price: false,
          total: true,
          actions: true,
        }),
      );
      localStorage.setItem('cart-table-density', 'compact');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const vm = await page.evaluate(() => localStorage.getItem('cart-view-mode'));
    const dens = await page.evaluate(() => localStorage.getItem('cart-table-density'));
    const cols = await page.evaluate(() => localStorage.getItem('cart-table-columns'));

    expect(vm).toBe('table');
    expect(dens).toBe('compact');
    const parsed = JSON.parse(cols!);
    expect(parsed.color).toBe(false);
    expect(parsed.price).toBe(false);
    expect(parsed.total).toBe(true);
    // Colunas obrigatórias devem permanecer true
    expect(parsed.quantity).toBe(true);
    expect(parsed.actions).toBe(true);
  });
});
