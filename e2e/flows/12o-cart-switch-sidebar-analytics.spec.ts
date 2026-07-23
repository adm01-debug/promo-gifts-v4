/**
 * 12o — Analytics de troca de empresa via navegação lateral (SellerCartsPage)
 *
 * Cobre o espelhamento de `cart.company_switched` quando a troca acontece
 * fora do QuickAdd: usuário está em /carrinhos/:cartA e navega para
 * /carrinhos/:cartB (via cards da lista, deep-link ou back/forward).
 *
 * Contrato validado:
 *   1. Um único evento `cart.company_switched` é emitido por transição.
 *   2. Payload:
 *        - source        = 'seller_carts_page'
 *        - fromCartId    = cartA.id (nunca null neste fluxo)
 *        - toCartId      = cartB.id
 *        - companyId     = cartB.company_id (quando presente)
 *        - companyName   = cartB.company_name (quando presente)
 *   3. Idempotência: re-navegar para o mesmo cartB não gera 2º evento.
 *   4. Não é emitido no mount inicial (chegada direta em /carrinhos/:cartA
 *      não é uma "troca").
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { gotoAndSettle } from "../helpers/nav";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";

const EVT = "cart.company_switched";

test.describe("Analytics — troca de carrinho via sidebar/URL", () => {
  test("emite cart.company_switched com source=seller_carts_page ao navegar A→B", async ({
    page,
  }) => {
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/carrinhos",
    });
    if (!cartB) {
      test.skip(true, "cartB ausente — configuração inesperada");
      return;
    }

    // Fase 1: pousar em cartA e limpar o buffer. O mount inicial NÃO deve
    // contar como troca (fromCartId seria null).
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await resetAnalyticsBuffer(page);

    // Fase 2: navegar para cartB — dispara o effect de sync no
    // useSellerCartsPage, que espelha o evento.
    await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

    await waitForEventSequence(page, [EVT], {
      timeout: 6_000,
      label: "sidebar-switch",
    });

    const events = await readAnalyticsEvents(page);
    const switched = events.filter((e) => e.name === EVT);

    // 2a. Exatamente 1 evento de switch nesta transição.
    expect(
      switched.length,
      `esperava 1 cart.company_switched, veio ${switched.length}: ` +
        JSON.stringify(switched, null, 2),
    ).toBe(1);

    const payload = switched[0]!.payload as {
      fromCartId: string | null;
      toCartId: string;
      companyId?: string | null;
      companyName?: string | null;
      source: string;
    };

    // 2b. Payload semântico.
    expect(payload.source).toBe("seller_carts_page");
    expect(payload.fromCartId).toBe(cartA.id);
    expect(payload.toCartId).toBe(cartB.id);
    if (cartB.company_id != null) {
      expect(payload.companyId ?? null).toBe(cartB.company_id);
    }
    if (cartB.company_name != null) {
      expect(payload.companyName ?? null).toBe(cartB.company_name);
    }

    // Fase 3: idempotência — re-navegar para cartB (mesma URL) não deve
    // gerar 2º evento. Reruns do effect (por refetch de `carts`) são
    // filtrados pela ref `lastSwitchEmittedForRef` no hook.
    await gotoAndSettle(page, `/carrinhos/${cartB.id}`);
    await page.waitForTimeout(500); // janela p/ possível re-emit
    const after = await readAnalyticsEvents(page);
    const switchedAfter = after.filter(
      (e) =>
        e.name === EVT &&
        (e.payload as { toCartId?: string }).toCartId === cartB.id,
    );
    expect(
      switchedAfter.length,
      "cart.company_switched foi re-emitido para o mesmo destino: " +
        JSON.stringify(switchedAfter, null, 2),
    ).toBe(1);
  });

  test("não emite cart.company_switched no mount inicial (chegada direta)", async ({
    page,
  }) => {
    const { cartA } = await setupAuthedWithCarts(page, {
      count: 1,
      itemsPerCart: 1,
      gotoUrl: "/carrinhos",
    });

    await resetAnalyticsBuffer(page);
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await page.waitForTimeout(600);

    const events = await readAnalyticsEvents(page);
    const switched = events.filter((e) => e.name === EVT);
    expect(
      switched.length,
      "mount inicial não deve emitir cart.company_switched: " +
        JSON.stringify(switched, null, 2),
    ).toBe(0);
  });
});
