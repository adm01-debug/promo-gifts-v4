/**
 * Regressão de ORDEM de analytics: durante o fluxo QuickAdd → Trocar
 * empresa → finalizar, os eventos DEVEM ser emitidos nesta subsequência:
 *
 *   1. cart.company_switched   (ao escolher o carrinho B no seletor)
 *   2. cart.checkout_started   (ao clicar em "Gerar Orçamento" — abre o
 *                               diálogo de confirmação ou navega direto)
 *   3. cart.quote_finalized    (após a confirmação, antes do navigate
 *                               para /orcamentos/novo)
 *
 * Por que subsequência (e não igualdade estrita)? Eventos secundários
 * (page_view, focus, telemetria de nav) podem intercalar. O contrato de
 * negócio é a ORDEM RELATIVA — coberta por `assertEventOrder`.
 *
 * Este spec reaproveita o caminho longo do 12g para gerar o `switched`
 * pela UI real, e o `handleGenerateQuote` do useSellerCartsPage para
 * gerar `started` → `finalized`.
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { gotoAndSettle } from "../helpers/nav";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";
import {
  assertEventOrder,
  readAnalyticsEvents,
  readAnalyticsEventNames,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");

test.describe("Analytics — ordem dos eventos no fluxo QuickAdd → finalizar", () => {
  test("emite switched → checkout_started → quote_finalized nesta ordem", async ({
    page,
  }, testInfo) => {
    const { cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/produtos",
    });
    if (!cartB) {
      test.skip(true, "cartB ausente — configuração inesperada");
      return;
    }

    // Buffer limpo antes de iniciar — evita interferência de eventos
    // acumulados durante o warmup da navegação inicial.
    await resetAnalyticsBuffer(page);

    // ---------- Fase 1: trocar carrinho pelo QuickAdd ---------------------
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
        test.skip(true, "Botão Trocar ausente");
        return;
      }
      await trocar.click();
    }
    await expect(selectorDialog).toBeVisible({ timeout: 8_000 });

    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Aguarda `cart.company_switched` aparecer no buffer.
    await waitForEventSequence(page, ["cart.company_switched"], {
      timeout: 5_000,
      label: "switch-phase",
    });

    // ---------- Fase 2: navegar até o carrinho B e finalizar --------------
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "analytics-order-checkout",
      selectors: {
        "cart-selector-dialog": SEL_SELECTOR_DIALOG,
        "cart-company-picker-select": SEL_COMPANY_PICKER,
      },
    });

    try {
      await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

      const checkoutCta = page.locator(SEL_CHECKOUT_CTA).first();
      if (!(await checkoutCta.isVisible().catch(() => false))) {
        test.info().annotations.push({
          type: "note",
          description:
            "CTA de finalização ausente — spec valida só switched (started/finalized dependem de itens persistidos).",
        });
        // Ainda assim, afirmamos que `switched` foi emitido.
        const names = await readAnalyticsEventNames(page);
        assertEventOrder(names, ["cart.company_switched"], {
          label: "partial-flow",
        });
        return;
      }

      await checkoutCta.click();

      // Confirma se houver diálogo de confirmação (useSellerCartsPage abre
      // `confirmQuoteCart` antes do finalize). Só clica se o botão de
      // confirmação existir — em ambientes sem itens, o handler já
      // encerra antes de abrir o diálogo.
      const confirmBtn = page
        .getByRole("button", { name: /gerar orçamento|confirmar/i })
        .last();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }

      // Navegação de sucesso.
      await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 10_000 });

      // ---------- Fase 3: asserts de ORDEM ---------------------------------
      // Aguarda os três eventos como subsequência ordenada.
      const finalNames = await waitForEventSequence(
        page,
        [
          "cart.company_switched",
          "cart.checkout_started",
          "cart.quote_finalized",
        ],
        { timeout: 6_000, label: "full-order" },
      );

      // Redundância defensiva: se a subsequência bateu, o assertEventOrder
      // não falha; se por algum motivo o waitFor timeout retornou eventos
      // fora de ordem, esta linha gera a mensagem descritiva final.
      assertEventOrder(
        finalNames,
        [
          "cart.company_switched",
          "cart.checkout_started",
          "cart.quote_finalized",
        ],
        { label: "full-order-assert" },
      );

      // Payload-check: `started.cartId` e `finalized.cartId` devem
      // referenciar o cartB (destino da troca). Isso protege contra a
      // regressão em que os eventos saem na ordem certa mas apontando
      // para o cart errado.
      const events = await readAnalyticsEvents(page);
      const started = events.find((e) => e.name === "cart.checkout_started");
      const finalized = events.find((e) => e.name === "cart.quote_finalized");
      expect(started, "cart.checkout_started ausente").toBeTruthy();
      expect(finalized, "cart.quote_finalized ausente").toBeTruthy();
      expect((started!.payload as { cartId: string }).cartId).toBe(cartB.id);
      expect((finalized!.payload as { cartId: string }).cartId).toBe(cartB.id);

      // `started` DEVE preceder `finalized` no timestamp (ISO comparável
      // lexicograficamente). Garante que a ordem não é só de inserção,
      // mas também temporal.
      expect(
        started!.ts <= finalized!.ts,
        `timestamp fora de ordem: started=${started!.ts} finalized=${finalized!.ts}`,
      ).toBe(true);
    } finally {
      await watcher.stop();
    }

    await watcher.assertNoHits();
  });
});
