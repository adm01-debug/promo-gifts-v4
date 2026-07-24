/**
 * E2E · Popover — latência variável (jitter) com cliques rápidos +/-.
 *
 * Simula um servidor real: cada PATCH em `seller_cart_items` responde com
 * latência aleatória entre 150ms e 1200ms (jitter). O vendedor alterna
 * rapidamente entre + e - várias vezes. Verificamos:
 *   • A UI reflete o valor final correto SEM flicker (nem no qty, nem no
 *     subtítulo com CNPJ/ramo — que não deve alternar por conta de
 *     re-render otimista/rollback).
 *   • Os writes são coalescidos pelo debounce: com N cliques rápidos, o
 *     servidor recebe << N PATCHes (limite razoável).
 *   • Não aparece alerta de erro para operações bem-sucedidas.
 */
import { test, expect, type Page } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';
import { gotoAndSettle } from '../helpers/nav';
import type { MockCart } from '../helpers/cart-mock';

function transformCart(cart: MockCart): MockCart {
  cart.company_id = 'co-jitter';
  cart.company_name = 'Empresa Jitter';
  cart.company_location = 'Varejo | Revenda';
  cart.seller_cart_items[0].id = 'item-jitter-1';
  cart.seller_cart_items[0].quantity = 10;
  return cart;
}

async function mockJitteredPatch(
  page: Page,
  opts: { minMs: number; maxMs: number },
): Promise<{ getCount: () => number }> {
  let count = 0;
  await page.route('**/rest/v1/seller_cart_items**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    count += 1;
    const delay =
      opts.minMs + Math.floor(Math.random() * Math.max(1, opts.maxMs - opts.minMs));
    await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ status: 204, body: '' });
  });
  return { getCount: () => count };
}

test.describe('Carrinhos · popover — latência variável + jitter @smoke', () => {
  test('12 cliques alternados com jitter 150-1200ms: commits coalescidos + zero flicker', async ({
    page,
  }) => {
    await setupAuthedWithCarts(page, {
      role: 'seller',
      count: 1,
      itemsPerCart: 1,
      gotoUrl: null,
      transform: (c) => transformCart(c),
    });
    const patch = await mockJitteredPatch(page, { minMs: 150, maxMs: 1200 });

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const qty = page.getByTestId('cart-item-qty-item-jitter-1');
    const subtitle = page.getByTestId('cart-company-subtitle-mock-cart-0');
    await expect(qty).toHaveText('10');

    // Captura o valor inicial do subtítulo (CNPJ ou ramo) — não deve alternar
    // durante a rajada de cliques + rollbacks/reconciliações.
    const subtitleInitial = ((await subtitle.textContent()) ?? '').trim();
    const subtitleKind = await subtitle.getAttribute('data-kind');

    const plus = page.getByRole('button', { name: /Aumentar quantidade/i }).first();
    const minus = page.getByRole('button', { name: /Diminuir quantidade/i }).first();

    // Sequência de 12 cliques em <1.5s: +,+,+,-,+,-,+,+,-,+,-,+
    // Delta líquido = +5 → esperado 15.
    const sequence = [plus, plus, plus, minus, plus, minus, plus, plus, minus, plus, minus, plus];
    // Sampler que checa que o subtítulo NUNCA muda durante a rajada.
    const subtitleSamples: Array<{ text: string; kind: string | null }> = [];
    for (const btn of sequence) {
      await btn.click();
      subtitleSamples.push({
        text: ((await subtitle.textContent()) ?? '').trim(),
        kind: await subtitle.getAttribute('data-kind'),
      });
    }

    // UI otimista converge no valor final antes da rede acabar.
    await expect(qty).toHaveText('15', { timeout: 600 });

    // Aguarda o pior caso de latência + debounce (~1500ms) + folga.
    await page.waitForTimeout(2200);

    // Consistência pós-servidor: qty continua 15 (nada de rollback).
    await expect(qty).toHaveText('15');

    // Nenhum alerta de erro para cliques bem-sucedidos.
    await expect(page.getByTestId('cart-item-error-item-jitter-1')).toHaveCount(0);

    // Subtítulo estável — sem flicker por causa de cache invalidation +
    // rollback/reconciliação. Deve permanecer no MESMO valor durante toda a
    // rajada e no estado final.
    for (const sample of subtitleSamples) {
      expect(sample.text).toBe(subtitleInitial);
      expect(sample.kind).toBe(subtitleKind);
    }
    await expect(subtitle).toHaveText(subtitleInitial);
    await expect(subtitle).toHaveAttribute('data-kind', subtitleKind ?? '');

    // Writes coalescidos: com 12 cliques em rajada + jitter, o servidor
    // deve receber muito menos que 12 PATCHes. Um invalidate após cada
    // commit pode gerar um 2º PATCH se um clique cair na borda; limitamos
    // conservadoramente em 4.
    const count = patch.getCount();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
  });
});
