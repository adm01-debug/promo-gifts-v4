/**
 * 12i — Erro na "troca de empresa" do carrinho não deve quebrar o fluxo.
 *
 * Cenário: com 2+ carrinhos, o vendedor abre o QuickAdd, clica em "Trocar"
 * e escolhe outro carrinho. A inserção no banco (POST seller_cart_items)
 * falha com 500. Regras que este spec valida:
 *
 *   1. Uma mensagem de erro (toast) fica visível para o usuário.
 *   2. O `CartSelectorDialog` NÃO reabre em loop após a falha.
 *   3. Navegar para o carrinho ativo continua funcionando — a UI não trava
 *      e o app não fica preso na tela de selecionar empresa.
 *
 * Escrito no mesmo estilo do 12g/12h (SSOT selectors + mockSellerCartsAPI).
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { mockSellerCartsAPI, makeMockCart } from "../helpers/cart-mock";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");

test.describe("Regressão: falha na troca de carrinho mostra erro e não quebra", () => {
  test.beforeEach(() => requireAuth());

  test("POST seller_cart_items 500 → toast de erro, sem loop de seletor, checkout navegável", async ({
    page,
  }) => {
    const cartA = makeMockCart(0, 1);
    const cartB = makeMockCart(1, 1);
    await mockSellerCartsAPI(page, [cartA, cartB]);

    // Intercepta inserção de itens e força 500 para simular a falha de
    // "troca de empresa" que estoura durante o insert no banco.
    let insertAttempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() === "POST") {
        insertAttempts += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST000",
            message: "simulated: switch cart insert failed",
            hint: null,
            details: null,
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

    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();

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

    // Escolhe o carrinho B → dispara o insert que vai falhar (500).
    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // O seletor deve fechar mesmo com erro (o handler decide se pré-seleciona
    // o cart e delega o erro para o toast do insert). Toleramos ambos os casos
    // (fechado OU ainda visível), mas garantimos que ele não fique "piscando"
    // em loop reabrindo sozinho.
    await selectorDialog
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => {});

    // 1. Mensagem de erro deve ficar visível. Sonner renderiza os toasts com
    //    data-type="error" no wrapper `[data-sonner-toast]`.
    const errorToast = page
      .locator('[data-sonner-toast][data-type="error"]')
      .first();
    await expect(errorToast).toBeVisible({ timeout: 6_000 });
    expect(insertAttempts).toBeGreaterThan(0);

    // 2. Watcher: garante que o seletor NÃO reabre em loop nos próximos
    //    segundos, mesmo depois do erro.
    let reopened = false;
    const watcher = setInterval(() => {
      void selectorDialog
        .isVisible()
        .then((v) => {
          if (v) reopened = true;
        })
        .catch(() => {});
    }, 100);

    try {
      // Dá tempo para qualquer efeito colateral tardio disparar.
      await page.waitForTimeout(1_500);

      // 3. O fluxo de finalizar deve continuar acessível — navegar até um
      //    carrinho não abre o picker de empresa nem quebra a página.
      const companyPicker = page.locator(SEL_COMPANY_PICKER).first();
      await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(companyPicker).toBeHidden({ timeout: 1_000 });
    } finally {
      clearInterval(watcher);
    }

    expect(
      reopened,
      "CartSelectorDialog NÃO deve reabrir sozinho após falha na troca",
    ).toBe(false);
  });
});
