/**
 * E2E: no viewport mobile, o carrinho ativo NÃO expõe o antigo botão
 * "Gerenciar Carrinho" (removido em definitivo) e o atalho substituto
 * "Ver Orçamentos" navega corretamente para /orcamentos.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';

test.describe('CartMobile · sem "Gerenciar Carrinho" @carrinhos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    await loginAs(page, 'user');
  });

  test('menu móvel não expõe "Gerenciar Carrinho" e "Ver Orçamentos" navega para /orcamentos', async ({
    page,
  }) => {
    const carts = [makeMockCart(0, 3)];
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);

    // Nenhuma menção renderizada — nem texto solto, nem botão acessível.
    await expect(page.getByText(/Gerenciar Carrinho/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Gerenciar Carrinho/i })).toHaveCount(0);

    // Atalho substituto existe. Clica e valida navegação.
    const viewQuotes = page.getByTestId('cart-view-quotes');
    await expect(viewQuotes).toBeVisible();
    await viewQuotes.click();
    await expect(page).toHaveURL(/\/orcamentos(\?|$)/);
  });
});
