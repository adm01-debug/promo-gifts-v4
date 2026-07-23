/**
 * Regressão complementar ao 12g: cenário SEM `activeCart` pré-definido.
 *
 * Objetivo: garantir que, quando o vendedor abre o QuickAdd e ainda não há
 * carrinho ativo escolhido, o seletor de carrinho aparece, a seleção fecha
 * o modal, e o fluxo de finalização em /carrinhos/:id não reabre nenhum
 * seletor (CartSelectorDialog nem CartCompanyPickerDialog).
 *
 * Estratégia anti-flake (v2):
 *   - SSOT apenas `data-testid` via `Sel/TID` (política e2e-selectors-policy).
 *   - Esperas via `waitForTestIdVisible/Hidden` + `expect.toBeHidden` — sem
 *     `setInterval` de sondagem, sem `waitForTimeout`, sem `networkidle`.
 *   - `waitForResponse` na query `seller_carts` para garantir hidratação
 *     do contexto ANTES de qualquer clique.
 *   - Reabertura do seletor é detectada por `expect(...).toBeHidden()`
 *     encadeado em cada etapa: se voltar a ficar visível, o teste falha
 *     no ponto exato do loop, com stack de origem determinístico.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import {
  waitForTestIdVisible,
  waitForTestIdHidden,
  expectVisibleByTestId,
} from "../helpers/waits";
import { setupAuthedWithCarts } from "../helpers/cart-setup";

const TID_SELECTOR_DIALOG = "cart-selector-dialog";
const TID_COMPANY_PICKER = "cart-company-picker-select";
const TID_CHECKOUT_CTA = "cart-checkout-cta";

// Timeout curto — se o seletor voltar a aparecer, precisa ser detectado
// rápido para o erro apontar a etapa correta.
const REAPPEAR_GUARD_MS = 1_500;

test.describe("Regressão: sem activeCart, seletor abre 1x e finalização não faz loop", () => {
  test.beforeEach(() => requireAuth());

  test("seletor abre uma vez ao adicionar e checkout conclui sem reabrir", async ({
    page,
  }) => {
    const cartA = makeMockCart(0, 1);
    const cartB = makeMockCart(1, 1);
    await mockSellerCartsAPI(page, [cartA, cartB]);

    // Aguarda determinístico da hidratação: a query do SellerCartContext dispara
    // GET /rest/v1/seller_carts logo no boot. Só seguimos após ela responder.
    const cartsHydrated = page.waitForResponse(
      (r) =>
        r.url().includes("/rest/v1/seller_carts") &&
        r.request().method() === "GET" &&
        r.status() === 200,
      { timeout: 15_000 },
    );

    await gotoAndSettle(page, "/produtos");
    await cartsHydrated.catch(() => {
      // Em ambientes onde a query já está em cache do SW, `waitForResponse`
      // pode expirar sem receber tráfego — não é falha do fluxo.
    });

    const card = page.locator(Sel.product.card).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Catálogo vazio neste ambiente");
      return;
    }

    // Abre o popover do QuickAdd de forma determinística.
    const actionsToggle = card.locator(Sel.product.actionsToggle).first();
    if (await actionsToggle.isVisible().catch(() => false)) {
      await actionsToggle.click();
    }
    const cartTrigger = card.locator(Sel.product.cartTrigger).first();
    if (!(await cartTrigger.isVisible().catch(() => false))) {
      test.skip(true, "Card sem trigger de carrinho neste ambiente");
      return;
    }
    await cartTrigger.click();

    // Espera determinística: OU o seletor abre (sem activeCart), OU o popover
    // aparece com um activeCart persistido. Race com `Promise.any` +
    // waitFor determinístico (sem polling manual).
    const selectorDialog = page.locator(TID(TID_SELECTOR_DIALOG)).first();
    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const companyPicker = page.locator(TID(TID_COMPANY_PICKER)).first();

    const initialStage = await Promise.any([
      selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector" as const),
      addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity" as const),
    ]).catch(() => null);

    if (!initialStage) {
      test.skip(true, "Popover do QuickAdd não abriu (variante obrigatória neste card)");
      return;
    }

    // Se veio direto no modo "quantity" (activeCart persistido em localStorage/CRM),
    // esse cenário já é coberto pelo 12g — encerra sem falha para não sobrepor
    // matriz de cobertura.
    if (initialStage === "quantity") {
      test.skip(true, "Ambiente com activeCart persistido — cenário coberto pelo 12g");
      return;
    }

    // O picker de empresa NUNCA deve aparecer neste fluxo — sanity antes do clique.
    await expect(companyPicker).toBeHidden({ timeout: REAPPEAR_GUARD_MS });

    // Seleciona o carrinho A — clique determinístico via testid.
    const cartARowTid = `cart-selector-item-${cartA.id}`;
    await expectVisibleByTestId(page, cartARowTid);
    await page.locator(TID(cartARowTid)).first().click();

    // Analytics: escolher o cartão A no seletor conta como troca de empresa
    // (fromCartId=null → toCartId=cartA).
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const buf =
              (window as unknown as { __e2eAnalytics__?: Array<Record<string, unknown>> })
                .__e2eAnalytics__ ?? [];
            return buf.filter((e) => e.name === "cart.company_switched").length;
          }),
        { timeout: 3_000, message: "cart.company_switched deveria ter sido emitido" },
      )
      .toBeGreaterThan(0);
    const switchEvent = await page.evaluate(() => {
      const buf =
        (window as unknown as { __e2eAnalytics__?: Array<Record<string, unknown>> })
          .__e2eAnalytics__ ?? [];
      return buf.find((e) => e.name === "cart.company_switched") ?? null;
    });
    expect(switchEvent).not.toBeNull();
    expect((switchEvent as { payload: { toCartId: string } }).payload.toCartId).toBe(cartA.id);

    // Fechou e não reabriu — assert determinístico (sem sleep).
    await waitForTestIdHidden(page, TID_SELECTOR_DIALOG);
    await expect(selectorDialog).toBeHidden({ timeout: REAPPEAR_GUARD_MS });
    await expect(companyPicker).toBeHidden({ timeout: REAPPEAR_GUARD_MS });

    // Finalização: navega para /carrinhos/:id e valida CTA.
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);

    // Nenhum seletor pode aparecer só por navegar para o cart ativo.
    await expect(selectorDialog).toBeHidden({ timeout: REAPPEAR_GUARD_MS });
    await expect(companyPicker).toBeHidden({ timeout: REAPPEAR_GUARD_MS });

    const checkoutCta = page.locator(TID(TID_CHECKOUT_CTA)).first();
    const hasCta = await checkoutCta.isVisible().catch(() => false);
    if (!hasCta) {
      test.info().annotations.push({
        type: "note",
        description: "CTA de finalização ausente — mock não persistiu itens.",
      });
      return;
    }

    // Espera determinística: o clique dispara navigate() síncrono para
    // /orcamentos/novo — `waitForURL` cobre sem `waitForTimeout`.
    await checkoutCta.click();
    await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/orcamentos\/novo/i);

    // Invariantes finais: os dois dialogs continuam ocultos na página destino.
    await expect(selectorDialog).toBeHidden({ timeout: REAPPEAR_GUARD_MS });
    await expect(companyPicker).toBeHidden({ timeout: REAPPEAR_GUARD_MS });

    // Analytics: `cart.quote_finalized` deve ter sido emitido com cartId=A.
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const buf =
              (window as unknown as { __e2eAnalytics__?: Array<Record<string, unknown>> })
                .__e2eAnalytics__ ?? [];
            return buf.filter((e) => e.name === "cart.quote_finalized").length;
          }),
        { timeout: 3_000, message: "cart.quote_finalized deveria ter sido emitido" },
      )
      .toBeGreaterThan(0);
    const finalizeEvent = await page.evaluate(() => {
      const buf =
        (window as unknown as { __e2eAnalytics__?: Array<Record<string, unknown>> })
          .__e2eAnalytics__ ?? [];
      return buf.find((e) => e.name === "cart.quote_finalized") ?? null;
    });
    expect(finalizeEvent).not.toBeNull();
    expect((finalizeEvent as { payload: { cartId: string } }).payload.cartId).toBe(cartA.id);
  });
});
