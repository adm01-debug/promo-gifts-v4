/**
 * 12s — Falha 4xx na troca de empresa preserva a empresa anterior no header
 *       e no carrinho, até que uma nova tentativa seja feita com sucesso.
 *
 * Complementa os specs 12i (500), 12m (aborto de rede) e 12n (RLS 42501):
 * eles cobrem "sem loop de seletor" + toast + CTA íntegro, mas NÃO afirmam
 * literalmente que o `active-cart-company-name` continua exibindo a empresa
 * do carrinho A. Este spec fecha exatamente esse gap e ainda valida o
 * caminho de recuperação (retry bem-sucedido).
 *
 * Contrato:
 *   1. POST /rest/v1/seller_cart_items → 400 (JSON schema violation).
 *   2. Após clicar em cartB no seletor, o `active-cart-company-name`
 *      DEVE continuar exibindo `cartA.company_name` (não trocar).
 *   3. `/carrinhos/:cartA.id` continua íntegro com o header do cartA.
 *   4. Nenhum picker/seletor reabre em loop.
 *   5. Retry: após remover o intercept, uma nova troca leva ao cartB —
 *      confirmando que o estado anterior não ficou "grudado".
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";
import { assertCartAddErrorToast } from "../helpers/cart-toast-assertions";
import { assertActiveCartHeader } from "../helpers/cart-assertions";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_ACTIVE_COMPANY = TID("active-cart-company-name");

test.describe("Regressão: 4xx na troca preserva empresa anterior", () => {
  test.beforeEach(() => requireAuth());

  test("400 no insert → header continua no cartA; retry funciona", async ({
    page,
  }, testInfo) => {
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: null,
    });
    if (!cartB) throw new Error("setupAuthedWithCarts com count=2 deveria gerar cartB");
    expect(
      cartA.company_name,
      "cartA e cartB precisam de company_name distinto para o assert de header",
    ).not.toBe(cartB.company_name);

    // Intercept que devolve 400 apenas na PRIMEIRA tentativa; segunda passa.
    let failNext = true;
    let insertAttempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      insertAttempts += 1;
      if (failNext) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "PGRST102",
            message: "invalid input syntax for type uuid",
            details: null,
            hint: null,
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

    // ============ 1ª tentativa: 4xx ============
    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    await selectorDialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12s-switch-4xx-preserves",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      // Toast de erro visível — sinaliza ao vendedor que a troca falhou.
      await assertCartAddErrorToast(page, { expectAutoDismiss: false });
      expect(insertAttempts, "insert deve ter sido tentado ao menos 1x").toBeGreaterThan(0);

      // ============ INVARIANTE PRINCIPAL ============
      // A empresa exibida no header DEVE continuar sendo a do cartA.
      // Poll determinístico: se em algum momento o header trocar para
      // cartB.company_name antes do retry, o teste falha.
      await assertActiveCartHeader(page, cartA);

      await expect
        .poll(
          async () => (await page.locator(SEL_ACTIVE_COMPANY).first().textContent()) ?? "",
          { timeout: 1_500, intervals: [200, 300, 500] },
        )
        .toContain(cartA.company_name);

      // Nada de picker de empresa surgindo após a falha.
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });

      // ============ Retry bem-sucedido ============
      // Libera o intercept e refaz a troca — confirma que o estado NÃO
      // ficou "preso" no cartA (o que também seria um bug).
      failNext = false;

      // Reabre o fluxo do QuickAdd num produto (novo clique no card).
      await gotoAndSettle(page, "/produtos");
      const card2 = page.locator(Sel.product.card).first();
      if (!(await card2.isVisible().catch(() => false))) return;
      const toggle2 = card2.locator(Sel.product.actionsToggle).first();
      if (await toggle2.isVisible().catch(() => false)) {
        await toggle2.click().catch(() => {});
      }
      const trigger2 = card2.locator(Sel.product.cartTrigger).first();
      if (!(await trigger2.isVisible().catch(() => false))) return;
      await trigger2.click();

      const selectorDialog2 = page.locator(SEL_SELECTOR_DIALOG).first();
      const addBtn2 = page.locator(Sel.product.cardAddToCart).first();
      const first2 = await Promise.race([
        addBtn2.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
        selectorDialog2.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
      ]).catch(() => null);
      if (!first2) return;
      if (first2 === "quantity") {
        const trocar2 = page.getByRole("button", { name: /^trocar$/i }).first();
        if (!(await trocar2.isVisible().catch(() => false))) return;
        await trocar2.click();
      }
      await expect(selectorDialog2).toBeVisible({ timeout: 8_000 });

      const cartBRow2 = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
      await expect(cartBRow2).toBeVisible({ timeout: 5_000 });
      await cartBRow2.click();
      await selectorDialog2.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

      // Agora o header DEVE refletir cartB — confirma que a preservação
      // anterior era do estado, não um "trava" permanente.
      await assertActiveCartHeader(page, cartB);
    } finally {
      await watcher.assertNoHits();
    }
  });
});
