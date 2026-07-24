/**
 * E2E: toggle do carrinho ativo no popover de carrinhos.
 *  - Clicar no header (ou no chevron) do carrinho ativo recolhe-o.
 *  - Após recolher: lista interna some, rodapé "Gerar Orçamento" some.
 *  - Clicar novamente expande: lista volta, rodapé volta com subtotal.
 *  - aria-expanded reflete o estado em ambos os controles (header + chevron).
 *
 * FIX BUG-14: Substituído localStorage 'cart-store-v1' (chave morta) por
 * page.route() mockando o endpoint PostgREST /rest/v1/seller_carts*.
 * Os testIds agora usam os IDs dos mocks ('mock-cart-0') em vez de 'seed-cart-0'.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { seedAndMock } from '../helpers/cart-mock';

test.describe('Carrinhos · toggle do carrinho ativo @smoke', () => {
  test('header e chevron recolhem/expandem o carrinho ativo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'seller');

    // Mocka ANTES da navegação para que a query inicial já retorne os mocks
    const [cart0] = await seedAndMock(page, { count: 3, itemsPerCart: 3 });

    await gotoAndSettle(page, '/');

    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const toggle = page.getByTestId(`cart-toggle-${cart0.id}`);
    const footer = page.getByTestId('cart-popover-footer');
    const firstItem = page.getByText(cart0.seller_cart_items[0].product_name, { exact: false }).first();

    // Estado inicial: expandido (primeiro carrinho ativo por padrão)
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(footer).toBeVisible();
    await expect(firstItem).toBeVisible();

    // Recolhe via chevron
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(firstItem).toBeHidden();
    await expect(footer).toBeHidden();
    await expect(page.getByTestId('cart-popover-scroll')).toBeVisible();

    // Expande novamente via chevron
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(firstItem).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/Gerar Orçamento/i);
    await expect(footer).toContainText(/Subtotal/i);

    // Recolhe via clique no header principal do carrinho
    await page
      .getByRole('button', { name: new RegExp(`Recolher carrinho de ${cart0.company_name}`, 'i') })
      .first()
      .click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(footer).toBeHidden();
  });
});
