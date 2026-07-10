/**
 * E2E: no viewport mobile, o carrinho ativo NÃO expõe o antigo botão
 * "Gerenciar Carrinho" NEM o atalho "Ver Orçamentos" — ambos removidos
 * em definitivo do header.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';

test.describe('CartMobile · sem "Gerenciar Carrinho" nem "Ver Orçamentos" @carrinhos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
    await loginAs(page, 'user');
  });

  test('menu móvel não expõe "Gerenciar Carrinho" nem "Ver Orçamentos"', async ({ page }) => {
    const carts = [makeMockCart(0, 3)];
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);

    await expect(page.getByText(/Gerenciar Carrinho/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Gerenciar Carrinho/i })).toHaveCount(0);

    // "Ver Orçamentos" também foi removido.
    await expect(page.getByTestId('cart-view-quotes')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver Orçamentos/i })).toHaveCount(0);
  });
});
