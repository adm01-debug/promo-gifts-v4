/**
 * 12q — Validação combinada do discriminante `source` em
 * `cart.company_switched` conforme a UI que originou a troca.
 *
 * Contrato (SSOT: src/lib/analytics/cartAnalytics.ts → CART_SWITCH_SOURCES):
 *   - Troca via CartSelectorDialog (QuickAdd)  → source = 'quick_add_selector'
 *   - Troca via navegação de rota /carrinhos/:id → source = 'seller_carts_page'
 *
 * Este spec percorre AMBOS os caminhos no mesmo run e afirma:
 *   1. Cada evento carrega o `source` correspondente à UI que o gerou.
 *   2. Os dois `source` DIFEREM entre eventos consecutivos (não há
 *      colapso/coerção que faça todos virarem o mesmo literal).
 *   3. `source` pertence ao enum canônico (defesa contra typos).
 *   4. Payload semântico (fromCartId/toCartId/companyId) casa com a UI.
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { gotoAndSettle } from "../helpers/nav";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";

const EVT = "cart.company_switched";
const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");

// Espelho do SSOT — se este array divergir de CART_SWITCH_SOURCES, o
// teste unitário cartAnalytics.source.contract.test.ts falha primeiro.
const ALLOWED_SOURCES = ["quick_add_selector", "seller_carts_page"] as const;

test.describe("Analytics — `source` de cart.company_switched por UI de origem", () => {
  test("selector → source=quick_add_selector; sidebar → source=seller_carts_page", async ({
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

    // ---------- FASE 1: troca via CartSelectorDialog (QuickAdd) ----------
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

    await waitForEventSequence(page, [EVT], {
      timeout: 6_000,
      label: "phase1-selector",
    });

    const phase1 = (await readAnalyticsEvents(page)).filter((e) => e.name === EVT);
    expect(phase1.length, "fase 1 deve emitir 1 evento").toBeGreaterThanOrEqual(1);
    const selectorEvt = phase1[phase1.length - 1]!;
    const p1 = selectorEvt.payload as {
      source: string;
      fromCartId: string | null;
      toCartId: string;
      companyId?: string | null;
    };
    expect(
      ALLOWED_SOURCES,
      `source fora do SSOT: ${p1.source}`,
    ).toContain(p1.source);
    expect(
      p1.source,
      `esperava 'quick_add_selector' na troca via CartSelectorDialog, veio '${p1.source}'`,
    ).toBe("quick_add_selector");
    expect(p1.toCartId).toBe(cartB.id);
    if (cartB.company_id != null) {
      expect(p1.companyId ?? null).toBe(cartB.company_id);
    }

    // Snapshot da contagem antes da fase 2 p/ isolar eventos novos.
    const countBeforePhase2 = phase1.length;

    // ---------- FASE 2: troca via navegação /carrinhos/:id (sidebar) -----
    // Após a fase 1, o activeCart é cartB. Pousamos em /carrinhos/cartB
    // (não conta como troca — mount) e depois navegamos para cartA.
    await gotoAndSettle(page, `/carrinhos/${cartB.id}`);
    // Pequena janela p/ eventuais eventos residuais do mount (não deveriam
    // emitir — coberto pelo spec 12o, aqui só evitamos race).
    await page.waitForTimeout(300);
    const preNavCount = (await readAnalyticsEvents(page)).filter(
      (e) => e.name === EVT,
    ).length;

    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await waitForEventSequence(page, [EVT], {
      timeout: 6_000,
      label: "phase2-sidebar",
    });

    const phase2Events = (await readAnalyticsEvents(page)).filter(
      (e) => e.name === EVT,
    );
    // Novos eventos = após preNavCount (não conta o de fase 1 nem
    // possíveis residuais do mount cartB).
    const newInPhase2 = phase2Events.slice(preNavCount);
    expect(
      newInPhase2.length,
      "fase 2 deve emitir ao menos 1 novo evento (B→A)",
    ).toBeGreaterThanOrEqual(1);

    const sidebarEvt = newInPhase2[newInPhase2.length - 1]!;
    const p2 = sidebarEvt.payload as {
      source: string;
      fromCartId: string | null;
      toCartId: string;
      companyId?: string | null;
    };
    expect(
      ALLOWED_SOURCES,
      `source fora do SSOT: ${p2.source}`,
    ).toContain(p2.source);
    expect(
      p2.source,
      `esperava 'seller_carts_page' na troca via navegação de rota, veio '${p2.source}'`,
    ).toBe("seller_carts_page");
    // Sidebar exige fromCartId não-nulo (é uma troca A→B real).
    expect(p2.fromCartId, "fromCartId em seller_carts_page nunca é null").not.toBeNull();
    expect(p2.fromCartId).toBe(cartB.id);
    expect(p2.toCartId).toBe(cartA.id);

    // ---------- Correlação final: os DOIS sources DIFEREM ----------------
    expect(
      p1.source,
      "sources das duas UIs devem diferir — se colapsaram, há coerção indevida",
    ).not.toBe(p2.source);

    // Sanity: nenhum evento intermediário com source desconhecido.
    for (const evt of phase2Events.slice(countBeforePhase2)) {
      const s = (evt.payload as { source: string }).source;
      expect(
        ALLOWED_SOURCES,
        `source desconhecido no buffer: '${s}' — atualize CART_SWITCH_SOURCES ou remova o callsite`,
      ).toContain(s);
    }
  });
});
