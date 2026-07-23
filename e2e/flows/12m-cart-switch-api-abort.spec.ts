/**
 * 12m — Falha de REDE na troca de empresa não pode prender o usuário no modal.
 *
 * Complementa o 12i (500 HTTP) cobrindo o cenário em que a API do `insert` do
 * novo carrinho é ABORTADA no transporte (ex.: conexão caiu, CORS quebrado,
 * timeout de proxy). O supabase-js resolve com erro sem status HTTP — é um
 * caminho de código diferente do 5xx e já causou regressões silenciosas.
 *
 * Contrato:
 *   1. Toast de erro (`[data-sonner-toast][data-type="error"]`) aparece.
 *   2. `CartSelectorDialog` fecha e NÃO reabre em loop.
 *   3. Analytics `cart.company_switched` FOI emitido (a intenção é tracked
 *      ANTES do insert — ver QuickAddToQuote.tsx L84-93).
 *   4. Analytics `cart.quote_finalized` NÃO é emitido.
 *   5. Navegar para /carrinhos/:id do carrinho A continua respondendo sem
 *      abrir `cart-company-picker-select`.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { mockSellerCartsAPI, makeMockCart } from "../helpers/cart-mock";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";
import { readAnalyticsEventNames, resetAnalyticsBuffer } from "../helpers/analytics";
import {
  assertActiveCartHeader,
  assertFinalizeCtaTargets,
} from "../helpers/cart-assertions";
import { assertCartAddErrorToast } from "../helpers/cart-toast-assertions";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");

test.describe("Regressão: aborto de rede na troca de carrinho", () => {
  test.beforeEach(() => requireAuth());

  test("POST seller_cart_items ABORTED → toast, sem loop, analytics coerente", async ({
    page,
  }, testInfo) => {
    const cartA = makeMockCart(0, 1);
    const cartB = makeMockCart(1, 1);
    await mockSellerCartsAPI(page, [cartA, cartB]);

    // Aborta o insert (não é 5xx — supabase-js resolve com "Failed to fetch"
    // sem status HTTP). Esse caminho já causou regressão silenciosa antes.
    let abortAttempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() === "POST") {
        abortAttempts += 1;
        await route.abort("failed");
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

    // Zera buffer de analytics logo antes da ação de switch.
    await resetAnalyticsBuffer(page);

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Seletor deve fechar — a partir daqui QUALQUER reabertura é loop bug.
    await selectorDialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    // Watcher inicia SÓ agora (o seletor já teve seu momento legítimo de
    // abertura). Qualquer reabertura daqui pra frente = falha rica com
    // screenshot + HTML anexados ao trace do Playwright.
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12m-switch-abort",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      // 1. Toast de erro visível.
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
      await expect(errorToast).toBeVisible({ timeout: 6_000 });
      expect(abortAttempts, "insert deveria ter sido tentado ao menos 1x").toBeGreaterThan(0);

      // 2. Confirma que o seletor não reabre nos próximos ~1.5s de forma
      //    determinística (sem waitForTimeout — banido pelo ESLint).
      await expect
        .poll(
          () => page.locator(SEL_SELECTOR_DIALOG).isVisible().catch(() => false),
          { timeout: 1_500, intervals: [200, 300, 500] },
        )
        .toBe(false);

      // 3. Analytics: switch foi emitido (intenção), finalize NÃO.
      const names = await readAnalyticsEventNames(page);
      expect(names, "cart.company_switched deve estar no buffer").toContain(
        "cart.company_switched",
      );
      expect(names, "cart.quote_finalized NÃO deve ter sido emitido").not.toContain(
        "cart.quote_finalized",
      );

      // 4. Navegar para o carrinho A ainda funciona — sem picker de empresa.
      await assertActiveCartHeader(page, cartA);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });

      // 5. CTA de finalizar do carrinho ORIGINAL continua apontando pra cartA.
      await assertFinalizeCtaTargets(page, cartA);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });
    } finally {
      await watcher.assertNoHits();
    }
  });
});
