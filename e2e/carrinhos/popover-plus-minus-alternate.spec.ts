/**
 * E2E · Popover — alternância rápida entre + e -.
 *
 * Cenário: o vendedor clica em sequência +,+,+,-,-,+,-,+ (8 cliques em <1s).
 * Objetivos:
 *  • A quantidade exibida no popover reflete o valor FINAL correto a todo
 *    momento (nada de flicker por rollback intermediário).
 *  • Os writes coalescem: com PATCH latente, no máximo 1–2 requisições
 *    chegam ao servidor (não 8).
 *  • Nenhum alerta de erro aparece (mutations bem-sucedidas → estado limpo).
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-alternate';
  cart.company_name = 'Empresa Alternate';
  cart.seller_cart_items[0].id = 'item-alt-1';
  cart.seller_cart_items[0].quantity = 5;
  return cart;
}

async function mockSlowPatch(
  page: Page,
  delayMs: number,
): Promise<{ getCount: () => number; getPayloads: () => Array<Record<string, unknown>> }> {
  let count = 0;
  const payloads: Array<Record<string, unknown>> = [];
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    count += 1;
    try {
      payloads.push(JSON.parse(route.request().postData() ?? '{}'));
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 204, body: '' });
  });
  return { getCount: () => count, getPayloads: () => payloads };
}

test.describe('Carrinhos · popover — alternância rápida +/- @smoke', () => {
  test('sequência +,+,+,-,-,+,-,+ termina em 5+1=6 com writes coalescidos', async ({ page }) => {
    await setupAuthedWithCarts(page, {
      role: 'seller',
      count: 1,
      itemsPerCart: 1,
      gotoUrl: null,
      transform: (c) => transformCart(c),
    });
    const patch = await mockSlowPatch(page, 600);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-alt-1');
    await expect(qty).toHaveText('5');

    const plus = page.getByRole('button', { name: /Aumentar quantidade/i }).first();
    const minus = page.getByRole('button', { name: /Diminuir quantidade/i }).first();

    // 8 cliques em <1s: +,+,+,-,-,+,-,+ → delta líquido = +1 → esperado 6
    for (const btn of [plus, plus, plus, minus, minus, plus, minus, plus]) {
      await btn.click();
    }

    // UI reflete o valor final ANTES da rede resolver.
    await expect(qty).toHaveText('6', { timeout: 400 });

    // Nenhum alerta de erro apareceu durante a sequência.
    await expect(page.getByTestId('cart-item-error-item-alt-1')).toHaveCount(0);

    // Aguarda debounce (300ms) + latência do PATCH (600ms) + folga.
    await page.waitForTimeout(1400);

    // Consistência: qty continua 6 depois do commit.
    await expect(qty).toHaveText('6');

    // Writes coalescidos: no máximo 2 PATCHes (razão: se o usuário clica
    // rápido dentro da janela de debounce, sai 1; um clique tardio pode
    // gerar um 2º). Nunca deve chegar perto de 8.
    const count = patch.getCount();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(2);
  });

  test('durante a sequência, o valor exibido nunca faz flicker para o inicial', async ({ page }) => {
    await loginAs(page, 'seller');
    await mockSellerCartsAPI(page, buildCarts());
    await mockSlowPatch(page, 500);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-alt-1');
    const plus = page.getByRole('button', { name: /Aumentar quantidade/i }).first();
    const minus = page.getByRole('button', { name: /Diminuir quantidade/i }).first();

    // Coleta o texto após cada clique — deve ser monotonicamente coerente
    // com o delta acumulado (sem "voltar para 5" no meio).
    const observed: string[] = [];
    for (const btn of [plus, plus, minus, plus]) {
      await btn.click();
      observed.push((await qty.textContent())?.trim() ?? '');
    }
    // Esperado após cada clique: 6, 7, 6, 7
    expect(observed).toEqual(['6', '7', '6', '7']);
  });
});
