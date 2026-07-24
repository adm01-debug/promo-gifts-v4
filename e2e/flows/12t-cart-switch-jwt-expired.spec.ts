/**
 * 12t — JWT expirado (401) na troca de empresa: toast de sessão expirada,
 *        CartSelectorDialog fecha sem loop e redireciona para /login?next=.
 *
 * Cobre o fluxo SSOT de `recoverSession()` (src/lib/auth/session-recovery.ts)
 * quando o PostgREST responde 401 com `{code:"PGRST301", message:"JWT
 * expired"}` durante o insert em `seller_cart_items` disparado pela troca de
 * carrinho no `CartSelectorDialog`.
 *
 * Contrato:
 *   1. POST /rest/v1/seller_cart_items → 401 PGRST301 "JWT expired".
 *   2. `refreshSession()` (POST /auth/v1/token?grant_type=refresh_token)
 *      também falha com bad_jwt → recoverSession força signOut + redirect.
 *   3. Toast "Sua sessão expirou. Faça login novamente." visível.
 *   4. `CartSelectorDialog` fica escondido — sem loop de reabertura.
 *   5. URL final = /login?next=<rota-anterior-encoded>.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SUPABASE_HOST_RE = /doufsxqlfjyuvxuezpln\.supabase\.co\/auth\/v1\/token/;

test.describe("Regressão: 401 JWT expirado → sessão expirada + redirect /login", () => {
  test.beforeEach(() => requireAuth());

  test("PostgREST 401 PGRST301 dispara recoverSession e navega para /login?next", async ({
    page,
  }, testInfo) => {
    const { cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: null,
    });
    if (!cartB) throw new Error("setupAuthedWithCarts com count=2 deveria gerar cartB");

    // 1) Insert falha com 401 "JWT expired" (formato canônico do PostgREST).
    let jwt401Attempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      jwt401Attempts += 1;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          // PostgREST propaga o motivo em WWW-Authenticate.
          "WWW-Authenticate": 'Bearer realm="postgrest", error="invalid_token"',
        },
        body: JSON.stringify({
          code: "PGRST301",
          message: "JWT expired",
          details: null,
          hint: null,
        }),
      });
    });

    // 2) Refresh token TAMBÉM falha com bad_jwt — força `recoverSession` a
    //    seguir o caminho "unrecoverable → signOut + redirect". Precedência
    //    de handlers do Playwright é LIFO, então este sobrepõe o `installMockAuth`.
    await page.route(SUPABASE_HOST_RE, async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("grant_type") === "refresh_token") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid Refresh Token: bad_jwt",
          }),
        });
        return;
      }
      await route.fallback();
    });

    await gotoAndSettle(page, "/produtos");

    const card = page.locator(Sel.product.card).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Catálogo vazio neste ambiente");
      return;
    }

    const actionsToggle = card.locator(Sel.product.actionsToggle).first();
    if (await actionsToggle.isVisible().catch(() => false)) {
      await actionsToggle.click().catch(() => {});
    }
    const cartTrigger = card.locator(Sel.product.cartTrigger).first();
    if (!(await cartTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Card sem trigger de carrinho neste ambiente");
      return;
    }
    await cartTrigger.click();

    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();
    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const first = await Promise.race([
      addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
      selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
    ]).catch(() => null);

    if (!first) {
      test.skip(true, "Popover do QuickAdd não abriu (variante obrigatória)");
      return;
    }
    if (first === "quantity") {
      const trocar = page.getByRole("button", { name: /^trocar$/i }).first();
      if (!(await trocar.isVisible().catch(() => false))) {
        test.skip(true, "Botão Trocar ausente");
        return;
      }
      await trocar.click();
    }
    await expect(selectorDialog).toBeVisible({ timeout: 8_000 });

    const routeAtSwitch = page.url().replace(/^https?:\/\/[^/]+/, "");

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Watcher só depois do click — reabertura do seletor a partir daqui é bug.
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12t-switch-jwt-expired",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      // 3) Toast "Sua sessão expirou. Faça login novamente." — copy SSOT de
      //    src/lib/auth/session-recovery.ts (não deve mudar sem atualizar este spec).
      const expiredToast = page.locator(
        '[data-sonner-toast][data-type="error"]',
        { hasText: /sess.o expirou/i },
      );
      await expect(expiredToast, "toast de sessão expirada deve aparecer").toBeVisible({
        timeout: 8_000,
      });

      // 4) Redirect para /login?next=<rotaAnterior>.
      await page.waitForURL(/\/login(\?|$)/, { timeout: 8_000 });
      const url = new URL(page.url());
      expect(url.pathname).toBe("/login");
      const next = url.searchParams.get("next");
      expect(next, "?next deve preservar a rota anterior").toBeTruthy();
      expect(
        decodeURIComponent(next ?? ""),
        "?next deve apontar para a rota do vendedor antes do erro",
      ).toContain(routeAtSwitch.split("?")[0]);

      // 5) Nenhum diálogo de carrinho pode ter sobrevivido ao redirect.
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });

      // 6) O insert que disparou o 401 foi tentado — sem retry infinito.
      expect(jwt401Attempts, "insert deveria ter sido tentado ao menos 1x").toBeGreaterThan(0);
      expect(
        jwt401Attempts,
        "não pode ter havido retry storm — recoverSession deduplica",
      ).toBeLessThanOrEqual(3);
    } finally {
      await watcher.assertNoHits();
    }
  });
});
