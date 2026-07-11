/**
 * Fluxo: exclusão de carrinho — cenários de erro, toasts acessíveis e retry.
 *
 * Cobre:
 *  1. DELETE falha (500) → toast de erro visível + carrinho permanece na lista.
 *  2. O toast (sucesso/erro) do sonner é acessível: container tem aria-label
 *     "Notifications" e o item de toast usa aria-live/role apropriados.
 *  3. Retry: após falha, clicar em "Excluir" novamente dispara o DELETE de novo;
 *     quando o backend volta a responder 204, o carrinho some da lista e um
 *     toast de sucesso aparece.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';
import { openCartPopover } from '../helpers/cart-fixture';
import type { Page, Route } from '@playwright/test';

interface DeleteHarness {
  carts: MockCart[];
  /** Quantidade de DELETE efetivamente disparados. */
  attempts: () => number;
  /** Alterna o modo do próximo DELETE. */
  setMode: (mode: 'fail' | 'ok') => void;
}

async function seedCartsWithToggleableDelete(page: Page): Promise<DeleteHarness> {
  const carts = [makeMockCart(0, 2), makeMockCart(1, 2)];
  await mockSellerCartsAPI(page, carts);

  let mode: 'fail' | 'ok' = 'fail';
  let attempts = 0;

  await page.route('**/rest/v1/seller_carts**', async (route: Route) => {
    const req = route.request();
    if (req.method() !== 'DELETE') return route.continue();
    attempts += 1;
    if (mode === 'fail') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'X-Mock-Source': 'cart-delete-error-spec' },
        body: JSON.stringify({
          code: 'PGRST500',
          message: 'delete failed',
          details: null,
          hint: null,
        }),
      });
    }
    const m = req.url().match(/id=eq\.([^&]+)/);
    const id = m?.[1];
    if (id) {
      const idx = carts.findIndex((c) => c.id === id);
      if (idx >= 0) carts.splice(idx, 1);
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'X-Mock-Source': 'cart-delete-error-spec' },
      body: JSON.stringify([{ id }]),
    });
  });

  return {
    carts,
    attempts: () => attempts,
    setMode: (m) => {
      mode = m;
    },
  };
}

test.describe('Excluir carrinho — falha, toast acessível e retry', () => {
  test.beforeEach(() => requireAuth());

  test('DELETE falha → toast de erro acessível + carrinho permanece na lista', async ({
    page,
  }) => {
    const harness = await seedCartsWithToggleableDelete(page);
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();

    await page.getByTestId('cart-delete-confirm').click();

    // Toast de erro do sonner: título "Operação falhou".
    const errorToast = page
      .locator('[data-sonner-toast][data-type="error"]')
      .filter({ hasText: 'Operação falhou' });
    await expect(errorToast).toBeVisible({ timeout: 5_000 });

    // O sonner é acessível: container com aria-label e itens em uma lista live.
    const region = page.locator('section[aria-label="Notifications"]');
    await expect(region).toBeAttached();
    // Cada toast fica dentro de um <ol aria-live="polite"> renderizado pelo sonner.
    const liveList = region.locator('ol[aria-live]');
    await expect(liveList.first()).toBeAttached();

    // Carrinho continua na lista (não foi otimista).
    await expect(page.getByText(target.company_name).first()).toBeVisible();

    // O dialog fica aberto para permitir nova tentativa.
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    expect(harness.attempts()).toBe(1);
  });

  test('retry: após falha, novo clique em Excluir dispara DELETE de novo e conclui', async ({
    page,
  }) => {
    const harness = await seedCartsWithToggleableDelete(page);
    const target = harness.carts[0];

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${target.id}`).click();
    await page.getByTestId('cart-delete-confirm').click();

    // Primeira tentativa: erro visível.
    await expect(
      page.locator('[data-sonner-toast][data-type="error"]').first(),
    ).toBeVisible({ timeout: 5_000 });
    expect(harness.attempts()).toBe(1);

    // Backend "recupera".
    harness.setMode('ok');

    // Segunda tentativa: mesmo botão de confirmar, dialog ainda aberto.
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();
    await page.getByTestId('cart-delete-confirm').click();

    // Dialog fecha após sucesso.
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({
      timeout: 5_000,
    });

    // Toast de sucesso "Carrinho removido" com role acessível.
    const successToast = page
      .locator('[data-sonner-toast][data-type="success"]')
      .filter({ hasText: 'Carrinho removido' });
    await expect(successToast.first()).toBeVisible({ timeout: 5_000 });

    // Dois DELETEs disparados no total.
    expect(harness.attempts()).toBe(2);

    // Carrinho removido da lista.
    await expect(page.getByText(target.company_name)).toHaveCount(0);
  });
});
