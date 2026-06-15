/**
 * E2E: lista de carrinhos exibe linha por carrinho com logo da empresa
 * e o clique em "Abrir" navega para /carrinhos/:id.
 *
 * Tolerante a base vazia: se não houver carrinhos, valida o empty state
 * e o botão "Novo carrinho".
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Carrinhos · lista → detalhe @smoke', () => {
  test('exibe logo na linha e navega para detalhe ao clicar em Abrir', async ({ page }) => {
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/carrinhos');

    await expect(page.getByTestId('page-title-carrinhos')).toBeVisible();
    await expect(page.getByTestId('carts-list-new')).toBeVisible();

    const firstRow = page.locator('[data-testid^="cart-row-"]').first();
    const rowCount = await firstRow.count();

    if (rowCount === 0) {
      // Empty state — botão de criar deve estar presente
      await expect(page.getByText(/Nenhum carrinho aberto/i)).toBeVisible();
      return;
    }

    // Logo (img) ou avatar fallback dentro da linha
    const logo = firstRow.locator('img, [class*="rounded-full"]').first();
    await expect(logo).toBeVisible();

    // Captura o id do carrinho a partir do testid
    const testId = await firstRow.getAttribute('data-testid');
    const cartId = testId?.replace('cart-row-', '');
    expect(cartId).toBeTruthy();

    await page.getByTestId(`cart-row-open-${cartId}`).click();
    await expect(page).toHaveURL(new RegExp(`/carrinhos/${cartId}`));
  });
});
