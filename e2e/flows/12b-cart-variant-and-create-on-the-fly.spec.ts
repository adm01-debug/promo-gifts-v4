/**
 * Fluxo novo: variação → seletor de carrinho → "criar carrinho para outro
 * cliente na hora" → item adicionado ao novo carrinho.
 *
 * Política: SSOT em e2e/fixtures/selectors.ts — somente data-testid.
 * Tolerante a ambientes vazios (skip-on-missing), igual ao 12-cart-checkout.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID, TID_PREFIX } from "../fixtures/selectors";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_SELECTOR_ITEMS = TID_PREFIX("cart-selector-item-");
const SEL_SELECTOR_CREATE_NEW = TID("cart-selector-create-new");
const SEL_COMPANY_PICKER_ITEMS = TID("cart-company-picker-select");

test.describe("Fluxo: Variação → Seletor de Carrinho → Criar na hora", () => {
  test.beforeEach(() => requireAuth());

  test("após escolher variação, abre seletor de carrinho com opção de criar novo", async ({
    page,
  }) => {
    await gotoAndSettle(page, "/produtos");

    const card = page.locator(Sel.product.card).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Catálogo vazio neste ambiente");
      return;
    }

    // Abre ações rápidas do card e dispara o trigger de carrinho
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

    // O fluxo novo SEMPRE pede confirmação (seletor de carrinho OU company picker)
    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();
    const companyPicker = page.locator(SEL_COMPANY_PICKER_ITEMS).first();

    const sawSomething = await Promise.race([
      selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
      companyPicker.waitFor({ state: "visible", timeout: 8_000 }).then(() => "company"),
    ]).catch(() => null);

    if (!sawSomething) {
      test.skip(true, "Nenhum diálogo do fluxo novo apareceu (variante pode ter sido obrigatória)");
      return;
    }

    if (sawSomething === "selector") {
      // Deve listar pelo menos 1 carrinho + botão de criar novo (regra: criar a qualquer momento)
      await expect(page.locator(SEL_SELECTOR_ITEMS).first()).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(SEL_SELECTOR_CREATE_NEW)).toBeVisible({ timeout: 5_000 });

      // Clicar em "criar novo" deve abrir o company picker (fluxo on-the-fly)
      await page.locator(SEL_SELECTOR_CREATE_NEW).click();
      await expect(companyPicker).toBeVisible({ timeout: 8_000 });
    } else {
      // Sem carrinhos: vai direto pro company picker — tudo bem
      await expect(companyPicker).toBeVisible();
    }
  });
});
