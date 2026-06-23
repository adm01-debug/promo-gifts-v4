/**
 * E2E: toggle do carrinho ativo no popover de carrinhos.
 *  - Clicar no header (ou no chevron) do carrinho ativo recolhe-o (sem precisar de outro carrinho).
 *  - Após recolher: lista interna some, rodapé "Gerar Orçamento" some.
 *  - Clicar novamente expande: lista volta, rodapé volta com o subtotal.
 *  - aria-expanded reflete o estado em ambos os controles (header + chevron).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const STORAGE_KEY = 'cart-store-v1';

function makeItems(i: number, n = 3) {
  return Array.from({ length: n }, (_, j) => ({
    id: `item-${i}-${j}`,
    product_id: `prod-${i}-${j}`,
    product_name: `Produto seed ${i}-${j}`,
    product_image_url: null,
    product_price: 19.9 + j,
    quantity: 10 + j,
    color_name: 'Preto',
    color_hex: '#000000',
  }));
}

async function seedCarts(page: Page, count = 3) {
  const carts = Array.from({ length: count }, (_, i) => ({
    id: `seed-cart-${i}`,
    company_id: `co-${i}`,
    company_name: `Empresa seed ${i.toString().padStart(2, '0')}`,
    company_location: 'BR',
    updated_at: new Date().toISOString(),
    items: makeItems(i),
  }));
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ state: { carts: value, activeCartId: value[0]?.id ?? null }, version: 1 }),
      );
    },
    { key: STORAGE_KEY, value: carts },
  );
}

test.describe('Carrinhos · toggle do carrinho ativo @smoke', () => {
  test('header e chevron recolhem/expandem o carrinho ativo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'seller');
    await gotoAndSettle(page, '/');
    await seedCarts(page, 3);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();

    const activeId = 'seed-cart-0';
    const toggle = page.getByTestId(`cart-toggle-${activeId}`);
    const footer = page.getByTestId('cart-popover-footer');
    // primeiro item semeado do carrinho ativo
    const firstItem = page.getByText('Produto seed 0-0', { exact: false }).first();

    // Estado inicial: expandido
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(footer).toBeVisible();
    await expect(firstItem).toBeVisible();

    // Recolhe via chevron — sem precisar clicar em outro carrinho
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(firstItem).toBeHidden();
    await expect(footer).toBeHidden();
    // Lista de carrinhos continua visível
    await expect(page.getByTestId('cart-popover-scroll')).toBeVisible();

    // Expande novamente via chevron
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(firstItem).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/Gerar Orçamento/i);
    await expect(footer).toContainText(/Subtotal/i);

    // Recolhe via clique no próprio header do carrinho (botão pai)
    await page
      .getByRole('button', { name: /Recolher carrinho de Empresa seed 00/i })
      .first()
      .click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(footer).toBeHidden();
  });
});
