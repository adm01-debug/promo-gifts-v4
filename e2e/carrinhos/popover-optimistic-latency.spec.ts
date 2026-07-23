/**
 * E2E · Popover "Meus Carrinhos" atualiza +/- e lixeira instantaneamente,
 * mesmo sob latência simulada no PATCH/DELETE de `seller_cart_items`.
 *
 * Cenários:
 *  1. `+` clicado 3 vezes rapidamente → o span de quantidade reflete o valor
 *      final ANTES de qualquer resposta do servidor. A rede recebe UM ÚNICO
 *      PATCH (debounce coalesce).
 *  2. Lixeira clicada → o item desaparece do popover antes do DELETE terminar.
 *
 * Este spec valida o contrato do update otimista + debounce implementado em
 * `useDebouncedCartItemActions`.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-optimistic';
  cart.company_name = 'Empresa Optimistic';
  cart.seller_cart_items[0].id = 'item-optimistic-1';
  cart.seller_cart_items[0].quantity = 3;
  return cart;
}

/** Intercepta PATCH em seller_cart_items com atraso configurável e conta chamadas. */
async function mockSlowItemPatch(
  page: Page,
  delayMs: number,
): Promise<{ getCount: () => number }> {
  let count = 0;
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    const method = route.request().method();
    if (method !== 'PATCH') return route.continue();
    count += 1;
    await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 204,
      body: '',
      headers: { 'Content-Range': '*/*' },
    });
  });
  return { getCount: () => count };
}

/** Intercepta DELETE com atraso longo — o item deve sumir antes de resolver. */
async function mockSlowItemDelete(page: Page, delayMs: number): Promise<void> {
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    const method = route.request().method();
    if (method !== 'DELETE') return route.continue();
    await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 204, body: '' });
  });
}

test.describe('Carrinhos · popover — update otimista + debounce @smoke', () => {
  test('cliques em + refletem instantaneamente e coalescem em 1 PATCH', async ({ page }) => {
    await setupAuthedWithCarts(page, {
      role: 'seller',
      count: 1,
      itemsPerCart: 1,
      gotoUrl: null,
      transform: (c) => transformCart(c),
    });
    const patch = await mockSlowItemPatch(page, 800);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-optimistic-1');
    await expect(qty).toHaveText('3');

    const plus = page.getByRole('button', {
      name: /Aumentar quantidade/i,
    }).first();

    // 3 cliques rápidos — a UI deve refletir o valor final antes do PATCH resolver.
    await plus.click();
    await plus.click();
    await plus.click();

    // UI reflete instantaneamente (< 300ms — antes do PATCH latente de 800ms resolver).
    await expect(qty).toHaveText('6', { timeout: 300 });

    // Espera o debounce (300ms) + latência (800ms) e verifica que só 1 PATCH ocorreu.
    await page.waitForTimeout(1300);
    expect(patch.getCount()).toBe(1);
  });

  test('clique na lixeira remove o item do popover instantaneamente com DELETE latente', async ({
    page,
  }) => {
    await loginAs(page, 'seller');
    await mockSellerCartsAPI(page, buildCarts());
    await mockSlowItemDelete(page, 1000);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-optimistic-1');
    await expect(qty).toBeVisible();

    // Botão X de remover — visível ao hover, mas em E2E força click direto.
    const removeBtn = page.getByRole('button', {
      name: /Remover .* do carrinho/i,
    }).first();
    await removeBtn.click({ force: true });

    // Item some do popover antes do DELETE terminar (update otimista).
    await expect(qty).toBeHidden({ timeout: 300 });
  });
});
