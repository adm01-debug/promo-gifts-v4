/**
 * 12v — Analytics de falha na troca de empresa
 *
 * Contrato validado (SSOT em `src/lib/analytics/cartAnalytics.ts`):
 *
 *   1. `cart.company_switched` é emitido ANTES do insert falhar.
 *   2. `cart.company_switch_failed` é emitido EXATAMENTE UMA VEZ após a
 *      falha (defesa contra double-fire por re-render/StrictMode).
 *   3. A ordem observada no buffer é estritamente:
 *          [..., 'cart.company_switched', 'cart.company_switch_failed']
 *      Nenhum outro evento `cart.*` deve intercalar.
 *   4. Os payloads dos dois eventos DEVEM concordar em:
 *          fromCartId, toCartId, companyId, companyName, source.
 *   5. `reason === 'mutation_failed'` para 4xx/5xx não-JWT.
 *   6. Um retry bem-sucedido emite `cart.company_switched` novamente e
 *      NÃO gera um segundo `cart.company_switch_failed` — evita
 *      contabilizar a mesma falha duas vezes.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import {
  readAnalyticsEvents,
  readAnalyticsEventNames,
  resetAnalyticsBuffer,
  assertEventOrder,
  waitForEventSequence,
  type AnalyticsEvent,
} from "../helpers/analytics";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");

interface SwitchPayload {
  fromCartId: string | null;
  toCartId: string;
  companyId?: string | null;
  companyName?: string | null;
  source: string;
  reason?: string;
  status?: number | null;
}

test.describe("Analytics: cart.company_switch_failed", () => {
  test.beforeEach(() => requireAuth());

  test("emite switched → switch_failed uma única vez na ordem correta", async ({
    page,
  }) => {
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: null,
    });
    if (!cartB) throw new Error("setupAuthedWithCarts com count=2 deveria gerar cartB");

    // Falha determinística no insert até que o teste libere.
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
            message: "invalid input syntax",
            details: null,
            hint: null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    await gotoAndSettle(page, "/produtos");
    await resetAnalyticsBuffer(page);

    const card = page.locator(Sel.product.card).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Catálogo vazio neste ambiente");
      return;
    }
    const toggle = card.locator(Sel.product.actionsToggle).first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click().catch(() => {});
    }
    const trigger = card.locator(Sel.product.cartTrigger).first();
    if (!(await trigger.isVisible().catch(() => false))) {
      test.skip(true, "Card sem trigger de carrinho");
      return;
    }
    await trigger.click();

    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();
    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const first = await Promise.race([
      addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
      selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
    ]).catch(() => null);
    if (!first) {
      test.skip(true, "Popover do QuickAdd não abriu");
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

    // === Ação: escolhe cartB → dispara switched + falha no insert ===
    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Aguarda a sequência aparecer antes de qualquer outra afirmação.
    const namesAfterFailure = await waitForEventSequence(
      page,
      ["cart.company_switched", "cart.company_switch_failed"],
      { label: "12v-primeira-falha", timeout: 8_000 },
    );

    // === Invariante 3: apenas os dois eventos esperados, sem intercalação ===
    const onlyCart = namesAfterFailure.filter((n) => n.startsWith("cart."));
    expect(
      onlyCart,
      `Esperado exatamente [switched, switch_failed]; buffer real: ${JSON.stringify(namesAfterFailure)}`,
    ).toEqual(["cart.company_switched", "cart.company_switch_failed"]);

    // === Invariante 2: exatamente 1 emissão de switch_failed ===
    const events = (await readAnalyticsEvents(page)) as AnalyticsEvent[];
    const failedEvents = events.filter((e) => e.name === "cart.company_switch_failed");
    expect(
      failedEvents.length,
      `switch_failed deve ser emitido 1x; observado ${failedEvents.length}. ` +
        `Duplicações indicam re-render ou StrictMode double-fire.`,
    ).toBe(1);

    // === Invariante 4: payloads coerentes ===
    const switchedEvt = events.find((e) => e.name === "cart.company_switched");
    if (!switchedEvt) throw new Error("cart.company_switched ausente");
    const switchedPayload = switchedEvt.payload as unknown as SwitchPayload;
    const failedPayload = failedEvents[0]!.payload as unknown as SwitchPayload;

    expect(failedPayload.toCartId).toBe(cartB.id);
    expect(failedPayload.toCartId).toBe(switchedPayload.toCartId);
    expect(failedPayload.fromCartId ?? null).toBe(switchedPayload.fromCartId ?? null);
    expect(failedPayload.source).toBe(switchedPayload.source);
    expect(failedPayload.source).toBe("quick_add_selector");
    expect(failedPayload.companyId ?? null).toBe(switchedPayload.companyId ?? null);
    expect(failedPayload.companyName ?? null).toBe(switchedPayload.companyName ?? null);
    // === Invariante 5: reason canônico ===
    expect(failedPayload.reason).toBe("mutation_failed");

    // Sanidade: o insert realmente foi tentado.
    expect(insertAttempts, "insert deve ter sido tentado ao menos 1x").toBeGreaterThan(0);

    // === Invariante 6: retry bem-sucedido NÃO gera segunda falha ===
    failNext = false;
    await resetAnalyticsBuffer(page);

    // Reabre o QuickAdd num produto e escolhe cartB de novo (agora sucesso).
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

    await waitForEventSequence(page, ["cart.company_switched"], {
      label: "12v-retry-ok",
      timeout: 8_000,
    });

    // Sequência final: só o switched, sem novo switch_failed encadeado.
    const finalNames = await readAnalyticsEventNames(page);
    const finalCartEvents = finalNames.filter((n) => n.startsWith("cart."));
    assertEventOrder(finalCartEvents, ["cart.company_switched"], {
      label: "12v-retry-ok-order",
    });
    expect(
      finalCartEvents.includes("cart.company_switch_failed"),
      `Retry bem-sucedido NÃO deve emitir switch_failed. Buffer: ${JSON.stringify(finalCartEvents)}`,
    ).toBe(false);
  });
});
