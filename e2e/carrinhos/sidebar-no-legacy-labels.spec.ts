/**
 * E2E smoke: CartSidebar pós-faxina não renderiza painéis legados.
 *
 * Trava qualquer regressão visual que reintroduza "Saúde do carrinho" /
 * "Inteligência de vendas" / "Histórico de ações" / "Sugestões inteligentes"
 * no sidebar. Roda no workflow `cart-quality.yml` sempre que
 * `src/pages/products/seller-carts/**` ou `src/components/cart/**` mudam.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart } from '../helpers/cart-mock';

const FORBIDDEN_LABELS = [
  /Saúde do carrinho/i,
  /Inteligência de vendas/i,
  /Histórico de ações/i,
  /Sugestões inteligentes/i,
  /Checklist do carrinho/i,
];

test.describe('CartSidebar · smoke pós-faxina (sem painéis legados)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'user');
  });

  test('sidebar mostra hero + CTA e NÃO renderiza Saúde/Inteligência/Histórico/Sugestões', async ({
    page,
  }) => {
    const carts = [makeMockCart(0, 3)];
    await mockSellerCartsAPI(page, carts);

    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);

    // Hero + CTA primária precisam estar presentes
    await expect(page.getByText(/Subtotal do carrinho/i)).toBeVisible();
    await expect(page.getByTestId('cart-checkout-cta')).toBeVisible();

    // Nenhum dos rótulos dos painéis removidos pode aparecer no DOM
    for (const label of FORBIDDEN_LABELS) {
      await expect(
        page.getByText(label),
        `Rótulo legado reintroduzido: ${label}`,
      ).toHaveCount(0);
    }
  });
});
