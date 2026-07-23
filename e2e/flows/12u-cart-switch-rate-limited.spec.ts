/**
 * 12u — Rate limit (429) na troca de empresa
 *
 * Complementa a série 12i (500) / 12m (abort) / 12n (RLS 403) / 12s (4xx) /
 * 12t (JWT 401) cobrindo o caminho de `Retry-After`/429 do PostgREST.
 *
 * Contrato validado
 * -----------------
 *   1. POST /rest/v1/seller_cart_items → 429 com `code: rate_limited`.
 *   2. `sanitizeError` mapeia isso para a mensagem pública SSOT
 *      "Muitas tentativas. Aguarde alguns minutos e tente novamente.".
 *   3. Toast de erro exibido com o título canônico
 *      `SELLER_CART_TOASTS.addItemError.title` E a description com
 *      a cópia acima (garante que o CI captura drift caso o
 *      `sanitize-error` regrida).
 *   4. Apenas 1 toast de erro (defesa contra loop de retries do
 *      TanStack Query — o hook usa `retry: 0` no mutation; se alguém
 *      trocar para `retry: 1+` sem `Retry-After` handling, empilharia
 *      N toasts idênticos).
 *   5. `active-cart-company-name` continua exibindo `cartA.company_name`.
 *   6. `CartSelectorDialog` fecha e NÃO reabre sozinho (watcher).
 *   7. Número de POSTs em `seller_cart_items` fica em `≤ 2` (uma
 *      tentativa inicial + no máximo um retry interno do onConflict do
 *      hook — jamais uma cascata).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";
import { assertCartAddErrorToast } from "../helpers/cart-toast-assertions";
import { assertActiveCartHeader } from "../helpers/cart-assertions";
import { SELLER_CART_TOASTS } from "../../src/hooks/products/sellerCartToasts";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_ACTIVE_COMPANY = TID("active-cart-company-name");
const RATE_LIMITED_COPY = /muitas tentativas\.\s*aguarde/i;

test.describe("Regressão: 429 na troca de empresa", () => {
  test.beforeEach(() => requireAuth());

  test("Rate limit → toast rate_limited; sem loop; empresa preservada", async ({
    page,
  }, testInfo) => {
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: null,
    });
    if (!cartB) throw new Error("setupAuthedWithCarts com count=2 deveria gerar cartB");
    expect(cartA.company_name).not.toBe(cartB.company_name);

    let insertAttempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      insertAttempts += 1;
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
        body: JSON.stringify({
          code: "rate_limited",
          message: "Too Many Requests",
          details: null,
          hint: null,
        }),
      });
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

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    await selectorDialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12u-switch-429",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      // 1) Toast canônico com o título SSOT.
      await assertCartAddErrorToast(page, { expectAutoDismiss: false });

      // 2) A description precisa refletir o mapeamento 429 → rate_limited.
      //    Assert direto na cópia pública para pegar drift de sanitize-error.
      const errorToast = page
        .locator('[data-sonner-toast][data-type="error"]')
        .filter({ hasText: SELLER_CART_TOASTS.addItemError.title })
        .first();
      await expect(
        errorToast,
        "Toast de rate limit deve exibir a mensagem pública 'Muitas tentativas…'",
      ).toContainText(RATE_LIMITED_COPY, { timeout: 3_000 });

      // 3) Sem cascata de retries — no máximo 2 POSTs (tentativa + retry
      //    interno do onConflict 23505). Um valor > 2 indica que alguém
      //    ligou `retry` no useMutation sem tratar Retry-After.
      expect(
        insertAttempts,
        `Rate limit não deve disparar cascata de retries; tentativas=${insertAttempts}`,
      ).toBeLessThanOrEqual(2);
      expect(insertAttempts, "insert precisa ter sido tentado ao menos 1x").toBeGreaterThan(0);

      // 4) Empresa exibida no header permanece cartA.
      await assertActiveCartHeader(page, cartA);
      await expect
        .poll(
          async () => (await page.locator(SEL_ACTIVE_COMPANY).first().textContent()) ?? "",
          { timeout: 1_500, intervals: [200, 300, 500] },
        )
        .toContain(cartA.company_name);

      // 5) Diálogos permanecem fechados após a falha.
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
    } finally {
      await watcher.assertNoHits();
    }
  });
});
