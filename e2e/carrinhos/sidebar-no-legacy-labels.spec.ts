/**
 * E2E smoke: CartSidebar pós-faxina não renderiza painéis legados.
 *
 * Trava qualquer regressão visual que reintroduza "Saúde do carrinho" /
 * "Inteligência de vendas" / "Histórico de ações" / "Sugestões inteligentes"
 * no sidebar. Roda no workflow `cart-quality.yml` sempre que
 * `src/pages/products/seller-carts/**` ou `src/components/cart/**` mudam.
 */
import { test, expect } from '@playwright/test';
import { setupAuthedWithCarts } from '../helpers/cart-setup';

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
  });

  test('sidebar mostra hero + CTA e NÃO renderiza Saúde/Inteligência/Histórico/Sugestões', async ({
    page,
  }) => {
    const { cartA } = await setupAuthedWithCarts(page, {
      role: 'user',
      count: 1,
      itemsPerCart: 3,
      gotoUrl: null,
    });
    const { gotoAndSettle } = await import('../helpers/nav');
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);

    // Espera o CartSidebar marcar data-loaded="true" no card hero —
    // mais determinístico que networkidle (que sofre com WebSockets/polling)
    // e elimina falso-verde em que getByText(...).toHaveCount(0) passa
    // antes do componente ter renderizado.
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-testid="cart-sidebar-hero"][data-loaded="true"]',
        ) !== null,
      undefined,
      { timeout: 15_000 },
    );

    // Sanity: hero + CTA visíveis
    await expect(page.getByTestId('cart-sidebar-hero')).toBeVisible();
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
