/**
 * cart-fixture.ts — Fixture E2E que semeia um carrinho autenticado com itens,
 * pronto para exercitar o PopoverQtyInput sem depender do banco real.
 *
 * Estratégia:
 *  1. Intercepta `GET /rest/v1/seller_carts*` e devolve um carrinho com N itens
 *     (nested-select `seller_cart_items(*)` já embutido).
 *  2. Intercepta `PATCH /rest/v1/seller_cart_items*` respondendo 204 — a
 *     mutação `updateItemQuantity` do React Query atualiza otimista, então o
 *     Total re-renderiza imediatamente ao digitar.
 *  3. Expõe um helper `openCartPopover(page)` que abre o popover do header.
 *
 * Uso típico em specs:
 *   const { cart } = await seedAuthedCartWithItems(page, { itemCount: 4 });
 *   await page.goto('/');
 *   await openCartPopover(page);
 *   await expect(page.getByTestId(`cart-item-qty-${cart.items[0].id}`)).toBeVisible();
 */
import type { Page } from '@playwright/test';
import { makeMockCart, mockSellerCartsAPI, type MockCart, type MockCartItem } from './cart-mock';

export interface SeedCartOptions {
  itemCount?: number;
  unitPrices?: number[];
  quantities?: number[];
}

export interface SeededCart {
  cart: MockCart;
  items: MockCartItem[];
  /** Preço unitário de cada item (na mesma ordem de `items`). */
  unitPrices: number[];
}

/**
 * Semeia UM carrinho autenticado com N itens. Preços/quantidades customizáveis.
 * Intercepta também PATCH de items para não vazar para o banco real.
 */
export async function seedAuthedCartWithItems(
  page: Page,
  opts: SeedCartOptions = {},
): Promise<SeededCart> {
  const itemCount = opts.itemCount ?? 3;
  const cart = makeMockCart(0, itemCount);

  // Aplica overrides de preço/quantidade quando fornecidos.
  const unitPrices: number[] = [];
  cart.seller_cart_items.forEach((it, i) => {
    if (opts.unitPrices?.[i] != null) it.product_price = opts.unitPrices[i];
    if (opts.quantities?.[i] != null) it.quantity = opts.quantities[i];
    unitPrices.push(it.product_price);
  });

  await mockSellerCartsAPI(page, [cart]);

  // PATCH silencioso — devolve 204 (No Content). O React Query já atualizou
  // otimista, então nem precisamos ecoar o corpo.
  await page.route('**/rest/v1/seller_cart_items**', (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 204,
        headers: { 'X-Mock-Source': 'cart-fixture-helper' },
        body: '',
      });
    }
    return route.continue();
  });

  return { cart, items: cart.seller_cart_items, unitPrices };
}

/**
 * Abre o popover do carrinho a partir do botão do header.
 * Espera o drawer ficar visível antes de retornar.
 */
export async function openCartPopover(page: Page): Promise<void> {
  const trigger = page.getByTestId('cart-trigger');
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();
  await page.getByTestId('cart-drawer').waitFor({ state: 'visible', timeout: 10_000 });
}

/**
 * Formata um número em BRL como o app formata (formatCurrency).
 * Espelha `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
