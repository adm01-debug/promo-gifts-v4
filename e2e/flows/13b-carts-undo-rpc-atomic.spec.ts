/**
 * E2E — Fluxo completo do Desfazer de carrinhos via RPC atômica.
 *
 * Cobre o refactor `restore_seller_cart` (SellerCartContext + useSellerCarts):
 *   • Sucesso: excluir carrinho → clicar "Desfazer" → aguardar RPC 200 →
 *     confirmação "Carrinho restaurado." aparece (não é falso positivo).
 *   • Falha por RLS: excluir carrinho → clicar "Desfazer" → RPC responde
 *     403 com code 42501 (RLS denied) → toast de erro é exibido com a
 *     mensagem sanitizada, SEM engolir o erro e SEM copy de sucesso.
 *
 * Garantias anti-regressão:
 *   1. `showUndoToast.onUndo` é aguardado antes de exibir sucesso.
 *   2. Erro sanitizado do RPC vaza no `description` do toast.error.
 *   3. Nenhuma variante de "Carrinho restaurado." aparece no DOM em falha.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { mockSellerCartsAPI, makeMockCart } from "../helpers/cart-mock";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const SELLER_CARTS_REST = /\/rest\/v1\/seller_carts(\?|$)/;
const SELLER_CART_ITEMS_REST = /\/rest\/v1\/seller_cart_items(\?|$)/;
const RESTORE_RPC = /\/rest\/v1\/rpc\/restore_seller_cart$/;
const UNDO_TOAST = '[data-testid="undo-toast"]';
const UNDO_BTN = '[data-testid="undo-toast-button"]';

async function primeCartsWithRpc(
  page: import("@playwright/test").Page,
  count: number,
  rpcHandler: (route: import("@playwright/test").Route) => Promise<void>,
) {
  const carts = Array.from({ length: count }, (_, i) => makeMockCart(i, 2));
  await mockSellerCartsAPI(page, carts);

  const calls = { delete: 0, rpc: 0 };

  await page.route(SELLER_CARTS_REST, async (route, request) => {
    if (request.method() === "DELETE") {
      calls.delete += 1;
      await route.fulfill({ status: 204, body: "", headers: { "Content-Range": "0-0/1" } });
      return;
    }
    await route.continue();
  });
  await page.route(SELLER_CART_ITEMS_REST, async (route) => {
    // Legado do path client-side: se o app ainda chamar por engano, respondemos 201
    // para não mascarar erros do RPC (a asserção principal é sobre o RPC).
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route(RESTORE_RPC, async (route) => {
    calls.rpc += 1;
    await rpcHandler(route);
  });

  return { calls };
}

async function excluirPrimeiraLinha(page: import("@playwright/test").Page) {
  const firstRowMenu = page
    .locator('[aria-label*="Ações"], [data-testid^="cart-row-menu-"]')
    .first();
  if (await firstRowMenu.count()) {
    await firstRowMenu.click();
    await page.getByRole("menuitem", { name: /excluir/i }).first().click();
  } else {
    await page.getByRole("button", { name: /excluir/i }).first().click();
  }
  const dialog = page.getByTestId("cart-row-delete-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /confirmar exclusão|excluir/i }).click();
}

test.describe("Carrinhos: Desfazer via RPC atômica (sucesso e falha RLS)", () => {
  test.beforeEach(() => {
    requireAuth();
  });

  test("sucesso — Desfazer chama restore_seller_cart e confirma 'Carrinho restaurado.'", async ({
    page,
  }) => {
    const { calls } = await primeCartsWithRpc(page, 2, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          cart_id: "restored-cart-1",
          items_total: 2,
          items_inserted: 2,
          items_deduped: 0,
        }),
      });
    });

    await gotoAndSettle(page, "/carrinhos");
    await excluirPrimeiraLinha(page);

    await expect.poll(() => calls.delete, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });

    // Clica Desfazer e aguarda o RPC ser chamado (fluxo completo)
    await page.locator(UNDO_BTN).click();
    await expect.poll(() => calls.rpc, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);

    // Confirmação só aparece após o RPC concluir com sucesso (não é falso positivo)
    await expect(page.getByText(/Carrinho restaurado\./)).toBeVisible({ timeout: 6_000 });
    await expect(page.locator("body")).not.toContainText(/Não foi possível restaurar/i);
  });

  test("falha RLS — RPC 403 (42501): toast de erro com descrição sanitizada, sem falso positivo", async ({
    page,
  }) => {
    const RLS_MESSAGE =
      "new row violates row-level security policy for table \"seller_carts\"";

    const { calls } = await primeCartsWithRpc(page, 2, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          code: "42501",
          message: RLS_MESSAGE,
          details: null,
          hint: null,
        }),
      });
    });

    await gotoAndSettle(page, "/carrinhos");
    await excluirPrimeiraLinha(page);

    await expect.poll(() => calls.delete, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator(UNDO_TOAST)).toBeVisible({ timeout: 6_000 });

    await page.locator(UNDO_BTN).click();
    await expect.poll(() => calls.rpc, { timeout: 8_000 }).toBeGreaterThanOrEqual(1);

    // Toast de erro é exibido com o título canônico
    await expect(
      page.getByText(/Não foi possível restaurar o carrinho\./i).first(),
    ).toBeVisible({ timeout: 6_000 });

    // O erro NÃO é engolido: a descrição sanitizada do RPC deve aparecer no DOM
    // (o SellerCartContext passa `description: <sanitizeError>` para o toast).
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /row-level security|permiss|não autorizad|forbidden/i })
        .first(),
    ).toBeVisible({ timeout: 6_000 });

    // Nunca pode aparecer "Carrinho restaurado." nem "Ação desfeita!" quando o
    // RPC falhou — showUndoToast aguarda onUndo antes de decidir sucesso.
    await expect(page.locator("body")).not.toContainText(/Carrinho restaurado\./);
    await expect(page.locator("body")).not.toContainText(/Ação desfeita!/);
  });
});
