/**
 * Fluxo: /carrinhos — duplicação falha graciosamente (RLS/limite).
 *
 * Estratégia: intercepta o POST do PostgREST para `seller_carts` e força uma
 * resposta 403 (RLS) e 400 (limite). Valida que:
 *  - O UI não quebra (a página segue montada e navegável).
 *  - Um toast de erro com título/descrição amigáveis aparece.
 *  - A contagem de carrinhos permanece igual (nenhum novo carrinho).
 *
 * SSOT: e2e/fixtures/selectors.ts — somente data-testid.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import type { Page } from "@playwright/test";

async function countRows(page: Page): Promise<number> {
  return page.locator(Sel.carts.rows).count();
}

async function firstCartId(page: Page): Promise<string | null> {
  const row = page.locator(Sel.carts.rows).first();
  if ((await row.count()) === 0) return null;
  const tid = await row.getAttribute("data-testid");
  return tid?.replace(/^cart-row-/, "") ?? null;
}

test.describe("/carrinhos — duplicação falha com toast amigável", () => {
  test.beforeEach(() => requireAuth());

  test("RLS 403 no POST /seller_carts → toast 'Permissão negada'", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos para exercitar duplicação");

    const cartId = await firstCartId(page);
    test.skip(!cartId, "sem cart id detectável");

    // Intercepta apenas o INSERT (POST) em seller_carts — leitura (GET) segue normal.
    await page.route(/\/rest\/v1\/seller_carts(\?|$)/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            code: "42501",
            message: "new row violates row-level security policy",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.locator(Sel.carts.rowMore(cartId!)).click();
    await page.locator(Sel.carts.rowMenuDuplicate(cartId!)).click();

    // Toast de erro aparece (título "Permissão negada" ou "Não foi possível…")
    const toast = page.locator(Sel.app.toast).first();
    await expect(toast).toBeVisible({ timeout: 5_000 });

    // Página segue montada
    await expect(page.locator(Sel.carts.pageTitle)).toBeVisible();

    // Nenhum carrinho novo foi criado
    expect(await countRows(page)).toBe(before);

    await page.unroute(/\/rest\/v1\/seller_carts(\?|$)/);
  });

  test("Limite atingido no POST /seller_carts → toast 'Limite … atingido'", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/carrinhos");
    const before = await countRows(page);
    test.skip(before === 0, "sem carrinhos");

    const cartId = await firstCartId(page);
    test.skip(!cartId, "sem cart id detectável");

    await page.route(/\/rest\/v1\/seller_carts(\?|$)/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            code: "P0001",
            message: "Limite de 10 carrinhos atingido. Exclua um carrinho para criar outro.",
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.locator(Sel.carts.rowMore(cartId!)).click();
    await page.locator(Sel.carts.rowMenuDuplicate(cartId!)).click();

    const toast = page.locator(Sel.app.toast).first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/limite/i);

    await expect(page.locator(Sel.carts.pageTitle)).toBeVisible();
    expect(await countRows(page)).toBe(before);

    await page.unroute(/\/rest\/v1\/seller_carts(\?|$)/);
  });
});
