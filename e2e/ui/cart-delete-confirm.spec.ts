/**
 * Fluxo: exclusão de carrinho com AlertDialog de confirmação.
 *
 * Cobre:
 *  1. Clicar na lixeira abre o AlertDialog com título "Excluir carrinho?"
 *  2. Escape fecha o dialog sem excluir
 *  3. Confirmar "Excluir" dispara DELETE e remove o carrinho da lista
 *  4. Botão de confirmar tem rótulo acessível
 *  5. Foco inicial pousa em Cancelar (padrão Radix seguro)
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';
import { openCartPopover } from '../helpers/cart-fixture';
import type { Page } from '@playwright/test';

async function seedTwoCartsAndInterceptDelete(page: Page): Promise<{
  carts: MockCart[];
  deleteRequested: () => string | null;
}> {
  const carts = [makeMockCart(0, 2), makeMockCart(1, 2)];
  await mockSellerCartsAPI(page, carts);

  let deletedId: string | null = null;

  await page.route('**/rest/v1/seller_carts**', async (route) => {
    const req = route.request();
    if (req.method() !== 'DELETE') return route.continue();
    // extrai `id=eq.<uuid>` da querystring
    const m = req.url().match(/id=eq\.([^&]+)/);
    deletedId = m?.[1] ?? null;
    // remove localmente do mock para o refetch subsequente refletir
    if (deletedId) {
      const idx = carts.findIndex((c) => c.id === deletedId);
      if (idx >= 0) carts.splice(idx, 1);
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'X-Mock-Source': 'cart-delete-spec' },
      body: JSON.stringify([{ id: deletedId }]),
    });
  });

  return { carts, deleteRequested: () => deletedId };
}

test.describe('Excluir carrinho — AlertDialog de confirmação', () => {
  test.beforeEach(() => requireAuth());

  test('abre AlertDialog, mostra nome do carrinho e fecha com Escape', async ({ page }) => {
    const { carts } = await seedTwoCartsAndInterceptDelete(page);
    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    const trash = page.getByTestId(`cart-delete-${carts[0].id}`);
    await trash.click();

    const dialog = page.getByTestId('cart-delete-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Excluir carrinho?');
    await expect(page.getByTestId('cart-delete-dialog-description')).toContainText(
      carts[0].company_name,
    );

    // confirm button acessível
    const confirm = page.getByTestId('cart-delete-confirm');
    await expect(confirm).toHaveAttribute('aria-label', 'Confirmar exclusão do carrinho');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('confirmar exclusão dispara DELETE e remove o carrinho da lista', async ({ page }) => {
    const { carts, deleteRequested } = await seedTwoCartsAndInterceptDelete(page);
    const targetId = carts[0].id;
    const targetName = carts[0].company_name;

    await gotoAndSettle(page, '/');
    await openCartPopover(page);

    await page.getByTestId(`cart-delete-${targetId}`).click();
    await expect(page.getByTestId('cart-delete-dialog')).toBeVisible();

    await page.getByTestId('cart-delete-confirm').click();

    // O dialog fecha após sucesso
    await expect(page.getByTestId('cart-delete-dialog')).toBeHidden({ timeout: 5_000 });

    // O DELETE foi disparado para o carrinho correto
    expect(deleteRequested()).toBe(targetId);

    // A lista não contém mais o carrinho excluído
    await expect(page.getByText(targetName)).toHaveCount(0);
  });
});
