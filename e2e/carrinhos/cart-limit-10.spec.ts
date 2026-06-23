/**
 * E2E: limite de 10 carrinhos.
 *  - Mocka 10 carrinhos via /rest/v1/seller_carts → botão "novo" fica desabilitado
 *    com aria-label/title igual ao texto SSOT de limite atingido.
 *  - Mocka 9 carrinhos → botão "novo" continua habilitado.
 *
 * Cobre o fluxo do 11º carrinho sem precisar bater no banco: a UI deriva
 * `canCreateCart = carts.length < MAX_SELLER_CARTS` a partir da resposta da API,
 * que aqui é controlada pelo helper cart-mock.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';
// Constantes espelham o SSOT em src/hooks/products/useSellerCarts.ts.
// Inline para evitar alias `@/` no contexto de execução do Playwright.
const MAX_SELLER_CARTS = 10;
const SELLER_CART_LIMIT_REACHED_SHORT = `Limite de ${MAX_SELLER_CARTS} carrinhos atingido`;

test.describe('Carrinhos · limite de 10 @smoke', () => {
  test('com 10 carrinhos, o botão "novo" fica bloqueado com tooltip de limite', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'seller');

    const carts = Array.from({ length: MAX_SELLER_CARTS }, (_, i) => makeMockCart(i, 1));
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, '/');

    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const newBtn = page.getByTestId('cart-tab-new');
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toBeDisabled();
    await expect(newBtn).toHaveAttribute('aria-label', SELLER_CART_LIMIT_REACHED_SHORT);
    await expect(newBtn).toHaveAttribute('title', SELLER_CART_LIMIT_REACHED_SHORT);
  });

  test('com 9 carrinhos, o botão "novo" continua habilitado', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'seller');

    const carts = Array.from({ length: MAX_SELLER_CARTS - 1 }, (_, i) => makeMockCart(i, 1));
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, '/');

    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const newBtn = page.getByTestId('cart-tab-new');
    await expect(newBtn).toBeEnabled();
    await expect(newBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');
  });
});
