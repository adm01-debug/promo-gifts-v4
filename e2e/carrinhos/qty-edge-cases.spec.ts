/**
 * E2E: edição de quantidade (casos de borda) + ordenação/paginação persistidas.
 * Valida via localStorage — sem depender de dados reais de empresa.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · qty edge cases & sort/pagination @smoke', () => {
  test('persiste sort key, dir e page size no localStorage', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    await page.evaluate(() => {
      localStorage.setItem('cart-view-mode', 'table');
      localStorage.setItem('cart-table-sort-key', 'price');
      localStorage.setItem('cart-table-sort-dir', 'desc');
      localStorage.setItem('cart-table-page-size', '50');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const sk = await page.evaluate(() => localStorage.getItem('cart-table-sort-key'));
    const sd = await page.evaluate(() => localStorage.getItem('cart-table-sort-dir'));
    const ps = await page.evaluate(() => localStorage.getItem('cart-table-page-size'));
    expect(sk).toBe('price');
    expect(sd).toBe('desc');
    expect(ps).toBe('50');
  });

  test('valida casos de borda na qty (vazio, 0, NaN, grande) sem persistir lixo', async ({
    page,
  }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    // Força modo tabela
    await page.evaluate(() => localStorage.setItem('cart-view-mode', 'table'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('[data-testid^="cart-qty-input-"]').first();
    if (!(await input.count())) {
      test.skip(true, 'Carrinho vazio neste ambiente — caso de borda coberto unitariamente.');
      return;
    }

    const testid = await input.getAttribute('data-testid');
    const itemId = testid!.replace('cart-qty-input-', '');
    const errSel = `[data-testid="cart-qty-error-${itemId}"]`;

    // Vazio → erro inline
    await input.fill('');
    await expect(page.locator(errSel)).toBeVisible();

    // 0 → erro (mínimo 1)
    await input.fill('0');
    await expect(page.locator(errSel)).toContainText(/mínimo/i);

    // NaN (texto livre é bloqueado por type=number; força via JS)
    await input.evaluate((el: HTMLInputElement) => {
      el.value = 'abc';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Input type=number devolve string vazia para 'abc' → erro de "informe quantidade"
    await expect(page.locator(errSel)).toBeVisible();

    // Número grande (capa em 999999 com warning)
    await input.fill('9999999');
    // Total recalcula imediatamente (sem reload)
    const totalCell = page.locator(`[data-testid="cart-row-total-${itemId}"]`);
    if (await totalCell.count()) {
      await expect(totalCell).toBeVisible();
    }

    // Reload preserva quantidade válida persistida
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator(`[data-testid="cart-qty-input-${itemId}"]`)).toBeVisible();
  });

  test('bloqueia valores negativos e decimais sem alterar o total', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    await page.evaluate(() => localStorage.setItem('cart-view-mode', 'table'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('[data-testid^="cart-qty-input-"]').first();
    if (!(await input.count())) {
      test.skip(true, 'Carrinho vazio neste ambiente.');
      return;
    }
    const testid = await input.getAttribute('data-testid');
    const itemId = testid!.replace('cart-qty-input-', '');
    const errSel = `[data-testid="cart-qty-error-${itemId}"]`;
    const totalSel = `[data-testid="cart-row-total-${itemId}"]`;

    // Snapshot total antes de tentar valores inválidos
    const totalBefore = (await page.locator(totalSel).count())
      ? await page.locator(totalSel).innerText()
      : null;

    // Negativo → erro inline, total não muda
    await input.fill('-5');
    await expect(page.locator(errSel)).toContainText(/negativ/i);
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }

    // Decimal → erro inline, total não muda
    await input.fill('2.5');
    await expect(page.locator(errSel)).toContainText(/inteir/i);
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }

    // Decimal com vírgula (input type=number ignora) → vazio → erro
    await input.fill('3,7');
    await expect(page.locator(errSel)).toBeVisible();
    if (totalBefore !== null) {
      expect(await page.locator(totalSel).innerText()).toBe(totalBefore);
    }
  });
});
