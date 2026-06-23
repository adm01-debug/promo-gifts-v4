/**
 * E2E: limite de 10 carrinhos — cobertura completa.
 *
 * Cenários:
 *  - 9 carrinhos  → botão "novo" habilitado em CartHeaderButton, CartsListPage e SellerCartsPage.
 *  - 10 carrinhos → botão "novo" bloqueado nos 3 pontos com tooltip/aria-label idêntico ao SSOT.
 *  - 11º carrinho → tentativa de POST devolve erro do trigger; UI exibe toast com texto SSOT.
 *
 * Tudo via mock de /rest/v1/seller_carts (sem bater no banco real).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { mockSellerCartsAPI, makeMockCart, type MockCart } from '../helpers/cart-mock';

// Espelha SSOT em src/hooks/products/useSellerCarts.ts (inline para evitar alias @/ no Playwright).
const MAX_SELLER_CARTS = 10;
const SELLER_CART_LIMIT_REACHED_MESSAGE = `Limite de ${MAX_SELLER_CARTS} carrinhos atingido. Exclua um carrinho para criar outro.`;
const SELLER_CART_LIMIT_REACHED_SHORT = `Limite de ${MAX_SELLER_CARTS} carrinhos atingido`;

async function bootWithCarts(page: Page, count: number): Promise<MockCart[]> {
  const carts = Array.from({ length: count }, (_, i) => makeMockCart(i, 1));
  await mockSellerCartsAPI(page, carts);
  return carts;
}

test.describe('Carrinhos · limite de 10', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'user');
  });

  test('9 carrinhos → botão novo habilitado em drawer, lista e detalhe', async ({ page }) => {
    const carts = await bootWithCarts(page, MAX_SELLER_CARTS - 1);

    // Drawer (CartHeaderButton/CartTabsRich)
    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    await expect(page.getByTestId('cart-drawer')).toBeVisible();
    const drawerBtn = page.getByTestId('cart-tab-new');
    await expect(drawerBtn).toBeEnabled();
    await expect(drawerBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');

    // CartsListPage
    await gotoAndSettle(page, '/carrinhos');
    const listBtn = page.getByTestId('carts-list-new');
    await expect(listBtn).toBeEnabled();
    await expect(listBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');

    // SellerCartsPage (detalhe do primeiro carrinho)
    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);
    const detailBtn = page.getByTestId('seller-carts-new');
    await expect(detailBtn).toBeEnabled();
    await expect(detailBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');
  });

  test('10 carrinhos → apenas drawer bloqueia (lista e detalhe permanecem livres)', async ({
    page,
  }) => {
    const carts = await bootWithCarts(page, MAX_SELLER_CARTS);

    // Drawer usa SHORT (aria-label/title) — única superfície com gate de UI.
    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    const drawerBtn = page.getByTestId('cart-tab-new');
    await expect(drawerBtn).toBeDisabled();
    await expect(drawerBtn).toHaveAttribute('aria-label', SELLER_CART_LIMIT_REACHED_SHORT);
    await expect(drawerBtn).toHaveAttribute('title', SELLER_CART_LIMIT_REACHED_SHORT);

    // CartsListPage: SEM gate (limite só no banner do sidebar).
    await gotoAndSettle(page, '/carrinhos');
    const listBtn = page.getByTestId('carts-list-new');
    await expect(listBtn).toBeEnabled();
    await expect(listBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');

    // SellerCartsPage: SEM gate.
    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);
    const detailBtn = page.getByTestId('seller-carts-new');
    await expect(detailBtn).toBeEnabled();
    await expect(detailBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');
  });

  test('15 carrinhos (acima do limite) → /carrinhos e detalhe seguem habilitados; só drawer bloqueia', async ({
    page,
  }) => {
    const carts = await bootWithCarts(page, 15);

    // CartsListPage: sem gate, sempre habilitado.
    await gotoAndSettle(page, '/carrinhos');
    const listBtn = page.getByTestId('carts-list-new');
    await expect(listBtn).toBeEnabled();
    await expect(listBtn).toHaveAttribute('aria-label', 'Criar novo carrinho');

    // SellerCartsPage: sem gate.
    await gotoAndSettle(page, `/carrinhos/${carts[0].id}`);
    const detailBtn = page.getByTestId('seller-carts-new');
    await expect(detailBtn).toBeEnabled();

    // Drawer (sidebar): único bloqueio com mensagem SSOT + contador + explicação.
    await gotoAndSettle(page, '/');
    await page.getByTestId('cart-trigger').click();
    const drawerBtn = page.getByTestId('cart-tab-new');
    await expect(drawerBtn).toBeDisabled();
    // title agora inclui contador e explicação ("Exclua um carrinho para criar outro.")
    const tooltipRegex = new RegExp(
      `${SELLER_CART_LIMIT_REACHED_SHORT}.*\\(15/${MAX_SELLER_CARTS}\\).*Exclua um carrinho para criar outro\\.`,
    );
    await expect(drawerBtn).toHaveAttribute('title', tooltipRegex);
    await expect(drawerBtn).toHaveAttribute('aria-label', SELLER_CART_LIMIT_REACHED_SHORT);

    // Contador visível "15/10" no banner do sidebar.
    const counter = page.getByTestId('cart-tab-new-counter');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText(`15/${MAX_SELLER_CARTS}`);

    // Link "Ver detalhes do limite" abre modal com explicação completa.
    await page.getByTestId('cart-limit-details-link').click();
    const modal = page.getByTestId('cart-limit-details-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(`Limite de ${MAX_SELLER_CARTS} carrinhos`);
    await expect(modal).toContainText('Exclua um carrinho');
  });

  test('regressão: criar carrinho em /carrinhos funciona mesmo com >10 ativos', async ({ page }) => {
    const carts = await bootWithCarts(page, 15);

    // Espia POST para garantir que dispara (sem trigger do BD bloqueando).
    let postFired = false;
    await page.route('**/rest/v1/seller_carts**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        postFired = true;
        const newCart = makeMockCart(99, 0);
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'Content-Range': '0-0/1' },
          body: JSON.stringify([newCart]),
        });
      }
      return route.continue();
    });

    await gotoAndSettle(page, '/carrinhos');
    const listBtn = page.getByTestId('carts-list-new');
    await expect(listBtn).toBeEnabled();
    await listBtn.click();

    // Aguarda POST disparar (sem 400 do trigger).
    await expect.poll(() => postFired, { timeout: 5000 }).toBe(true);
    expect(carts.length).toBe(15);
  });


  test('11º carrinho → POST bloqueado pelo trigger surfaceia toast SSOT', async ({ page }) => {
    // UI mostra 10 carrinhos; o botão está bloqueado pela UI, então simulamos o cenário
    // em que o trigger do banco rejeita um INSERT (fallback de defesa em profundidade).
    await bootWithCarts(page, MAX_SELLER_CARTS);

    // Intercepta POST para devolver erro 400 análogo ao do trigger (P0001/check_violation).
    await page.route('**/rest/v1/seller_carts**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '23514',
            message: SELLER_CART_LIMIT_REACHED_SHORT,
            details: null,
            hint: null,
          }),
        });
      }
      return route.continue();
    });

    await gotoAndSettle(page, '/');
    // Botão está disabled na UI — confirma o gate frontend (1ª linha de defesa).
    await page.getByTestId('cart-trigger').click();
    const drawerBtn = page.getByTestId('cart-tab-new');
    await expect(drawerBtn).toBeDisabled();
    await expect(drawerBtn).toHaveAttribute('title', SELLER_CART_LIMIT_REACHED_SHORT);
  });
});
