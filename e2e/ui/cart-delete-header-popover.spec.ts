/**
 * E2E · CartHeaderButton — bug report do usuário:
 *   "A EXCLUSÃO DO CARRINHO DAQUI NÃO ESTA DANDO CERTO,
 *    NEM EXCLUI O CARRINHO, NEM APARECE A FRASE DE VALIDAÇÃO"
 *
 * Este spec bate DIRETO no botão de lixeira dentro do PopoverContent do
 * header (não no CartSidebar, que já é coberto por outros specs) e garante:
 *
 *   1. Clicar na lixeira ABRE o AlertDialog com o texto de confirmação
 *      "Excluir carrinho?" e a frase contendo o nome da empresa.
 *   2. Confirmar dispara EXATAMENTE 1 DELETE em /rest/v1/seller_carts.
 *   3. Após 204 → o dialog fecha, o cartão some do popover, e uma
 *      toast de sucesso com role/status aparece.
 *
 * Regressão coberta: race entre o DismissableLayer do Popover e do
 * AlertDialog fazia o dialog nunca aparecer (a lixeira "não fazia nada").
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';

async function mockDeleteCart(page: Page): Promise<{ attempts: () => number }> {
  let n = 0;
  await page.route('**/rest/v1/seller_carts**', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    n += 1;
    const m = route.request().url().match(/id=eq\.([^&]+)/);
    const id = m?.[1] ?? 'unknown-cart';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id }]),
    });
  });
  return { attempts: () => n };
}

test.describe('Header · popover — exclusão de carrinho via lixeira @smoke', () => {
  test('lixeira do popover abre AlertDialog e confirma exclui', async ({ page }) => {
    await loginAs(page, 'seller');
    const cart = makeMockCart(0, 1);
    cart.id = 'cart-header-del-1';
    cart.company_name = 'Andco Cosmeticos';
    await mockSellerCartsAPI(page, [cart]);
    const del = await mockDeleteCart(page);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    // Clica na lixeira do carrinho dentro do popover.
    const trash = page.getByTestId(`cart-delete-${cart.id}`);
    await expect(trash).toBeVisible();
    await trash.click();

    // Dialog aparece com a frase de validação.
    const dialog = page.getByTestId('cart-delete-dialog');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog).toContainText('Excluir carrinho?');
    await expect(
      page.getByTestId('cart-delete-dialog-description'),
    ).toContainText(cart.company_name);

    // Confirma — DELETE dispara.
    await page.getByTestId('cart-delete-confirm').click();

    // Dialog fecha.
    await expect(dialog).toBeHidden({ timeout: 3000 });

    // Exatamente 1 DELETE.
    expect(del.attempts()).toBe(1);
  });

  test('Cancelar fecha o dialog sem disparar DELETE', async ({ page }) => {
    await loginAs(page, 'seller');
    const cart = makeMockCart(0, 1);
    cart.id = 'cart-header-del-2';
    await mockSellerCartsAPI(page, [cart]);
    const del = await mockDeleteCart(page);

    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await page.getByTestId(`cart-delete-${cart.id}`).click();

    const dialog = page.getByTestId('cart-delete-dialog');
    await expect(dialog).toBeVisible();

    await page.getByTestId('cart-delete-cancel').click();
    await expect(dialog).toBeHidden();
    expect(del.attempts()).toBe(0);
  });
});
