/**
 * E2E · Popover "Meus Carrinhos" — input de tiragem NÃO seleciona o valor ao focar.
 *
 * Regressão para a mudança em `SortableCartItem.tsx`: o `onFocus` posiciona o
 * cursor no fim via `requestAnimationFrame` + `setSelectionRange(end, end)`,
 * eliminando o antigo `e.target.select()`.
 *
 * Como `<input type="number">` não expõe `selectionStart`/`selectionEnd` de
 * forma confiável (Chromium lança / retorna null), validamos o comportamento
 * de forma **funcional**: se o valor estivesse selecionado, digitar um dígito
 * o REPLACERIA; sem seleção, o dígito é APPENDADO ao valor existente.
 *
 * Cenários:
 *  1. Foco via clique → digitar "9" no valor "3" resulta em "39".
 *  2. Foco via Tab    → digitar "9" no valor "3" resulta em "39".
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-focus-noselect';
  cart.company_name = 'Empresa Focus NoSelect';
  cart.seller_cart_items[0].id = 'item-focus-1';
  cart.seller_cart_items[0].quantity = 3;
  return cart;
}

/**
 * Silencia PATCHes de quantidade — o blur após digitar dispara commit; queremos
 * evitar timeouts de rede sem afetar o valor exibido pelo update otimista.
 */
async function stubQtyPatch(page: Page): Promise<void> {
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await route.fulfill({ status: 204, body: '', headers: { 'Content-Range': '*/*' } });
  });
}

async function openPopoverWithItem(page: Page) {
  await setupAuthedWithCarts(page, {
    role: 'seller',
    count: 1,
    itemsPerCart: 1,
    gotoUrl: null,
    transform: (c) => transformCart(c),
  });
  await stubQtyPatch(page);
  await gotoAndSettle(page, '/');
  await page.getByTestId('cart-trigger').click();
  await expect(page.getByTestId('cart-drawer')).toBeVisible();
  const qty = page.getByTestId('cart-qty-input').first();
  await expect(qty).toBeVisible();
  await expect(qty).toHaveValue('3');
  return qty;
}

test.describe('Carrinhos · popover — foco no input de tiragem não seleciona o valor', () => {
  test('foco via clique preserva o valor existente (dígito é appendado, não substitui)', async ({
    page,
  }) => {
    const qty = await openPopoverWithItem(page);

    await qty.click();
    // Aguarda o rAF do onFocus aplicar setSelectionRange(end, end) antes de digitar.
    await page.waitForTimeout(50);
    await page.keyboard.type('9');

    // Se o valor estivesse selecionado (comportamento antigo), viraria "9".
    // Sem seleção, o cursor está no fim → resultado "39".
    await expect(qty).toHaveValue('39');
  });

  test('foco via Tab preserva o valor existente (dígito é appendado, não substitui)', async ({
    page,
  }) => {
    const qty = await openPopoverWithItem(page);

    // O decrement fica imediatamente antes do input no DOM — Tab a partir dele
    // leva foco ao input via teclado (caminho onde browsers costumam aplicar
    // seleção implícita em <input type="number">).
    const dec = page.getByTestId('cart-qty-decrement').first();
    await dec.focus();
    await page.keyboard.press('Tab');
    await expect(qty).toBeFocused();

    // Aguarda o rAF do onFocus antes de digitar.
    await page.waitForTimeout(50);
    await page.keyboard.type('9');

    await expect(qty).toHaveValue('39');
  });
});
