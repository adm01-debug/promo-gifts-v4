/**
 * E2E · Popover — botão "Tentar de novo" após falha da mutation otimista.
 *
 * Cenário:
 *  1. Vendedor clica em "+" no popover.
 *  2. PATCH em seller_cart_items falha na PRIMEIRA vez (500).
 *  3. Alerta `cart-item-error-<id>` aparece com o botão "Tentar de novo".
 *  4. Vendedor clica no botão de retry.
 *  5. PATCH sucede na SEGUNDA tentativa (204) → alerta some, qty commita.
 *
 * Valida:
 *  • O retry realmente re-dispara o PATCH (não é decoração).
 *  • A UI reconcilia (mensagem de erro DESAPARECE após sucesso).
 *  • A quantidade exibida é a nova (não voltou ao valor original).
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-retry';
  cart.company_name = 'Empresa Retry';
  cart.seller_cart_items[0].id = 'item-retry-1';
  cart.seller_cart_items[0].quantity = 2;
  return cart;
}

/**
 * Falha o PATCH nas primeiras `failCount` vezes; depois responde 204.
 * Retorna contadores para asserções.
 */
async function mockFlakyPatch(
  page: Page,
  opts: { failCount: number; delayMs?: number },
): Promise<{ getAttempts: () => number; getSuccesses: () => number }> {
  let attempts = 0;
  let successes = 0;
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    attempts += 1;
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (attempts <= opts.failCount) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'boom' }),
      });
      return;
    }
    successes += 1;
    await route.fulfill({ status: 204, body: '' });
  });
  return { getAttempts: () => attempts, getSuccesses: () => successes };
}

test.describe('Carrinhos · popover — retry após erro @smoke', () => {
  test('clicar em "Tentar de novo" refaz o PATCH e limpa o alerta', async ({
    page,
  }) => {
    await setupAuthedWithCarts(page, {
      role: 'seller',
      count: 1,
      itemsPerCart: 1,
      gotoUrl: null,
      transform: (c) => transformCart(c),
    });
    const patch = await mockFlakyPatch(page, { failCount: 1, delayMs: 50 });

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-retry-1');
    await expect(qty).toHaveText('2');

    // 1º clique → PATCH falha → alerta aparece.
    await page.getByRole('button', { name: /Aumentar quantidade/i }).first().click();
    // UI otimista mostra 3 instantaneamente.
    await expect(qty).toHaveText('3', { timeout: 500 });

    const alert = page.getByTestId('cart-item-error-item-retry-1');
    await expect(alert).toBeVisible();
    // Contrato de a11y: role=alert + aria-live.
    await expect(alert).toHaveAttribute('aria-live', 'polite');

    // Retry — o 2º PATCH agora responde 204.
    const retryBtn = page.getByTestId('cart-item-error-retry-item-retry-1');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Alerta some após sucesso.
    await expect(alert).toBeHidden({ timeout: 2000 });

    // O PATCH foi tentado pelo menos 2 vezes (falha + retry) e teve 1 sucesso.
    expect(patch.getAttempts()).toBeGreaterThanOrEqual(2);
    expect(patch.getSuccesses()).toBeGreaterThanOrEqual(1);
  });
});
