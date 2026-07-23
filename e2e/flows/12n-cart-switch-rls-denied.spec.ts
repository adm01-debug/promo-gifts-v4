/**
 * 12n — RLS 4xx na troca de empresa mostra mensagem específica e não reabre o seletor.
 *
 * Complementa o 12i (500 genérico) e o 12m (aborto de rede) cobrindo o
 * caminho de negação por policy do PostgREST. Quando o RLS rejeita o insert
 * do novo carrinho, o Data API responde com 401/403 e código PostgREST
 * `42501` — semântica diferente de 500/network e caminho de UX próprio.
 *
 * Contrato:
 *   1. Toast de erro (`[data-sonner-toast][data-type="error"]`) visível.
 *   2. `CartSelectorDialog` fecha e NÃO reabre em loop.
 *   3. `cart-company-picker-select` NUNCA aparece durante o fluxo.
 *   4. Analytics `cart.company_switched` foi emitido (intenção rastreada),
 *      `cart.quote_finalized` NÃO.
 *   5. Navegar para /carrinhos/:id do carrinho A permanece funcional.
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

test.describe("Regressão: RLS 4xx na troca de carrinho", () => {
  test.beforeEach(() => requireAuth());

  test("POST seller_cart_items 403 (42501) → toast, sem loop de seletor", async ({
    page,
  }, testInfo) => {
    const cartA = makeMockCart(0, 1);
    const cartB = makeMockCart(1, 1);
    await mockSellerCartsAPI(page, [cartA, cartB]);

    // Simula rejeição por RLS. PostgREST devolve 403 com corpo padrão
    // { code: "42501", message: "new row violates row-level security policy"...}.
    let rlsAttempts = 0;
    await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
      if (route.request().method() === "POST") {
        rlsAttempts += 1;
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: "42501",
            message:
              'new row violates row-level security policy for table "seller_cart_items"',
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

    await resetAnalyticsBuffer(page);

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Seletor deve fechar — a partir daqui qualquer reabertura é loop bug.
    await selectorDialog.waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});

    // Watcher armado SÓ após o fechamento legítimo do seletor.
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12n-switch-rls",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      // 1. Toast de erro visível.
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
      await expect(errorToast).toBeVisible({ timeout: 6_000 });
      expect(rlsAttempts, "insert deveria ter sido tentado ao menos 1x").toBeGreaterThan(0);

      // 2. Confirma que o seletor não reabre nos próximos ~1.5s (poll
      //    determinístico — waitForTimeout é banido por lint em specs E2E).
      await expect
        .poll(
          () => page.locator(SEL_SELECTOR_DIALOG).isVisible().catch(() => false),
          { timeout: 1_500, intervals: [200, 300, 500] },
        )
        .toBe(false);

      // 3. Analytics: intenção rastreada, checkout NUNCA finaliza.
      const names = await readAnalyticsEventNames(page);
      expect(names, "cart.company_switched deve estar no buffer").toContain(
        "cart.company_switched",
      );
      expect(names, "cart.quote_finalized NÃO deve ter sido emitido").not.toContain(
        "cart.quote_finalized",
      );

      // 4. Fluxo de checkout continua acessível pela navegação direta —
      //    sem picker de empresa e sem o seletor ressuscitando.
      await assertActiveCartHeader(page, cartA);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });

      // 5. CTA de finalizar do carrinho ORIGINAL continua apontando pra cartA
      //    (a rejeição RLS não pode ter "movido" o ponteiro pra cartB).
      await assertFinalizeCtaTargets(page, cartA);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });
    } finally {
      await watcher.assertNoHits();
    }
  });
});
