/**
 * E2E: no viewport mobile, o carrinho ativo NÃO expõe o antigo botão
 * "Gerenciar Carrinho" NEM o atalho "Ver Orçamentos" — ambos removidos
 * em definitivo do header.
 */
import { test, expect } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';

test.describe('CartMobile · sem "Gerenciar Carrinho" nem "Ver Orçamentos" @carrinhos', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
  });

  test('menu móvel não expõe "Gerenciar Carrinho" nem "Ver Orçamentos"', async ({ page }) => {
    const { cartA } = await setupAuthedWithCarts(page, {
      role: 'user',
      count: 1,
      itemsPerCart: 3,
      gotoUrl: `/carrinhos/mock-cart-0`,
    });
    // gotoUrl acima usa id previsível gerado por makeMockCart
    void cartA;

    await expect(page.getByText(/Gerenciar Carrinho/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Gerenciar Carrinho/i })).toHaveCount(0);

    // "Ver Orçamentos" também foi removido.
    await expect(page.getByTestId('cart-view-quotes')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver Orçamentos/i })).toHaveCount(0);
  });
});
