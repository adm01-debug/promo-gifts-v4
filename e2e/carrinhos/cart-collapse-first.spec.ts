/**
 * E2E: recolher/expandir o PRIMEIRO carrinho da listagem.
 *
 * Regressão do bug "não consigo colapsar o primeiro carrinho (Vibrasil)":
 * `SellerCartContext.resolvedActiveCartId` fazia fallback para `carts[0].id`
 * quando `activeCartId === null`, impedindo o recolhimento do primeiro item.
 *
 * Garante também:
 *  - feedback visual imediato (`aria-pressed`, `data-collapsed`)
 *  - persistência do estado de colapso em localStorage após refresh.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';

test.describe('Carrinhos · recolher/expandir primeiro carrinho', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'user');
  });

  test('primeiro carrinho colapsa, expande e persiste após refresh', async ({ page }) => {
    const carts = [makeMockCart(0, 1), makeMockCart(1, 1), makeMockCart(2, 1)];
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const firstToggle = page.getByTestId(`cart-toggle-${carts[0].id}`);

    // Inicial: primeiro carrinho ativo/expandido.
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'false');

    // Click 1 — recolher.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'true');
    await expect(firstToggle).toHaveAttribute('aria-pressed', 'true');

    // Click 2 — expandir de novo.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'false');

    // Recolhe novamente e valida persistência após reload.
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('data-collapsed', 'true');

    const stored = await page.evaluate(() =>
      window.localStorage.getItem('seller:collapsed-cart-ids'),
    );
    expect(stored).toContain(carts[0].id);

    await page.reload();
    await page.getByTestId('cart-trigger').click();
    const firstToggleAfter = page.getByTestId(`cart-toggle-${carts[0].id}`);
    await expect(firstToggleAfter).toHaveAttribute('data-collapsed', 'true');
  });
});
