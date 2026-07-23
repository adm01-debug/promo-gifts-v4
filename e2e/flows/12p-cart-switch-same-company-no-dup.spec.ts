/**
 * 12p — Idempotência de `cart.company_switched` quando o vendedor
 * "re-seleciona" o mesmo carrinho/empresa que já é o ativo.
 *
 * Contrato coberto:
 *   Em `QuickAddToQuote.handleAddToQuote`, a emissão de
 *   `cart.company_switched` está guardada por `cartId !== activeCart?.id`
 *   (src/components/products/QuickAddToQuote.tsx:84). Portanto, quando o
 *   vendedor abre o `CartSelectorDialog` e clica novamente na linha do
 *   carrinho ativo, o evento NÃO deve ser emitido — evitando poluição do
 *   funil analítico com "trocas" que não trocaram nada.
 *
 * Cenário:
 *   1. 2 carrinhos semeados, cartA ativo (setup default).
 *   2. Buffer de analytics limpo.
 *   3. QuickAdd em um card → chega em quantity OU direto no selector.
 *      3a. Se quantity: clicar "Trocar" para abrir o selector.
 *   4. Clicar na linha do PRÓPRIO cartA (mesma empresa).
 *   5. Assert: nenhum `cart.company_switched` no buffer, mesmo após
 *      janela de 800ms para eventos assíncronos.
 *
 * Sanity-check paralelo: em seguida, trocar de fato para cartB para
 * garantir que o pipeline de emissão funciona no mesmo run (evita falso
 * verde caso o buffer esteja quebrado por outra razão).
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";

const EVT = "cart.company_switched";
const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");

test.describe("Analytics — re-seleção da mesma empresa NÃO duplica evento", () => {
  test("clicar no carrinho ativo no selector não emite cart.company_switched", async ({
    page,
  }) => {
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/produtos",
    });
    if (!cartB) {
      test.skip(true, "cartB ausente — configuração inesperada");
      return;
    }

    await resetAnalyticsBuffer(page);

    // ---------- Abrir QuickAdd num card do catálogo ----------------------
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

    // O QuickAdd pode abrir direto no selector (sem activeCart) OU no
    // popover de quantity (com activeCart). Como o setup deixa cartA
    // ativo, esperamos quantity → clicar em "Trocar" p/ abrir o selector.
    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();

    const first = await Promise.race([
      addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
      selectorDialog
        .waitFor({ state: "visible", timeout: 8_000 })
        .then(() => "selector"),
    ]).catch(() => null);

    if (!first) {
      test.skip(true, "Popover do QuickAdd não abriu");
      return;
    }

    if (first === "quantity") {
      const trocar = page.getByRole("button", { name: /^trocar$/i }).first();
      if (!(await trocar.isVisible().catch(() => false))) {
        test.skip(true, "Botão Trocar ausente — não é possível reabrir o selector");
        return;
      }
      await trocar.click();
    }
    await expect(selectorDialog).toBeVisible({ timeout: 8_000 });

    // ---------- Re-selecionar o MESMO cartA -------------------------------
    const cartARow = page.locator(TID(`cart-selector-item-${cartA.id}`)).first();
    await expect(cartARow).toBeVisible({ timeout: 5_000 });
    await cartARow.click();

    // Janela para eventuais eventos assíncronos (log.info, side-effects).
    // 800ms é > que a latência típica do buffer analytics em CI.
    await page.waitForTimeout(800);

    const eventsAfterSame = await readAnalyticsEvents(page);
    const dupSwitches = eventsAfterSame.filter(
      (e) =>
        e.name === EVT &&
        (e.payload as { toCartId?: string }).toCartId === cartA.id,
    );
    expect(
      dupSwitches.length,
      "cart.company_switched foi emitido para o carrinho JÁ ATIVO (deveria ser guardado por `cartId !== activeCart?.id`): " +
        JSON.stringify(dupSwitches, null, 2),
    ).toBe(0);

    // ---------- Sanity: trocar de verdade emite normalmente ---------------
    // Se o buffer estivesse "silenciado" por bug de setup, o assert acima
    // passaria por razões erradas. Forçamos uma troca real p/ garantir
    // que o pipeline emite quando deve.
    if (!(await selectorDialog.isVisible().catch(() => false))) {
      // Reabre o QuickAdd → Trocar caso o dialog tenha fechado após click.
      await cartTrigger.click().catch(() => {});
      const addBtn2 = page.locator(Sel.product.cardAddToCart).first();
      if (await addBtn2.isVisible({ timeout: 4_000 }).catch(() => false)) {
        const trocar2 = page.getByRole("button", { name: /^trocar$/i }).first();
        if (await trocar2.isVisible().catch(() => false)) {
          await trocar2.click();
        }
      }
      await expect(selectorDialog).toBeVisible({ timeout: 6_000 });
    }

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    await waitForEventSequence(page, [EVT], {
      timeout: 5_000,
      label: "sanity-real-switch",
    });

    const finalEvents = await readAnalyticsEvents(page);
    const realSwitches = finalEvents.filter(
      (e) =>
        e.name === EVT &&
        (e.payload as { toCartId?: string }).toCartId === cartB.id,
    );
    expect(
      realSwitches.length,
      "sanity check: troca real A→B deveria emitir exatamente 1 evento",
    ).toBe(1);

    // Reafirma que a re-seleção do mesmo cartA continua sem evento
    // (nenhum emit retroativo apareceu enquanto processávamos a troca real).
    const stillNoDup = finalEvents.filter(
      (e) =>
        e.name === EVT &&
        (e.payload as { toCartId?: string }).toCartId === cartA.id,
    );
    expect(stillNoDup.length, "re-seleção de cartA continua sem evento").toBe(0);
  });
});
