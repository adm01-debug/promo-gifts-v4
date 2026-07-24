/**
 * 12r — Troca de empresa para um carrinho VAZIO
 *
 * Cobre o gap: quando o vendedor troca para um carrinho sem itens,
 * o fluxo continua íntegro (evento de switch emite, sem loop de
 * `cart-selector-dialog`) E os CTAs de finalização ficam bloqueados
 * com a mensagem correta ("Adicione itens ao carrinho antes de gerar
 * um orçamento" / "Carrinho vazio").
 *
 * Contrato validado
 * -----------------
 *   1. Setup: cartA com 1 item, cartB vazio (`seller_cart_items: []`).
 *   2. Pousar em /carrinhos/:cartA → resetar buffer de analytics.
 *   3. Navegar para /carrinhos/:cartB (troca via URL):
 *        3a. Emite exatamente 1 `cart.company_switched` com
 *            `toCartId=cartB.id`, `source=seller_carts_page`.
 *        3b. NENHUM `cart-selector-dialog` aparece — flow não entra em
 *            loop de "escolha a empresa" só porque o carrinho está vazio.
 *   4. Header do cartB:
 *        4a. `cart-checkout-cta` presente MAS `disabled` +
 *            `aria-disabled="true"` + `title` incluindo "Adicione itens".
 *        4b. Clicar mesmo assim NÃO navega para /orcamentos/novo e NÃO
 *            emite `cart.quote_finalized`.
 *   5. Lista `/carrinhos`:
 *        5a. Menu "..." do cartB → item "Orçamento" com
 *            `data-disabled` (Radix). Clicar (via `.click({ force: true })`)
 *            NÃO dispara navegação NEM emite `cart.quote_finalized`.
 *   6. Sanity: voltar para cartA (com itens) → CTA habilita, finalize
 *      via helper `finalizeActiveCart` sai limpo (fluxo geral não regride).
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { gotoAndSettle } from "../helpers/nav";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";
import { finalizeActiveCart } from "../helpers/cart-finalize";

const EVT_SWITCHED = "cart.company_switched";
const EVT_FINALIZED = "cart.quote_finalized";

const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");
const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");

test.describe("Troca de empresa para carrinho VAZIO", () => {
  test("troca para carrinho vazio: switch emite, CTA bloqueia, sem loop", async ({
    page,
  }) => {
    // 1. cartA com 1 item, cartB sem itens (transform zera seller_cart_items).
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/carrinhos",
      waitForHydration: true,
      transform: (cart, idx) =>
        idx === 1
          ? {
              ...cart,
              company_name: `Empresa VAZIA ${idx.toString().padStart(2, "0")}`,
              seller_cart_items: [],
            }
          : cart,
    });
    if (!cartB) {
      test.skip(true, "cartB ausente — configuração inesperada");
      return;
    }

    // 2. Pousa em cartA (com itens) e limpa o buffer.
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await resetAnalyticsBuffer(page);

    // 3. Troca para o cartB vazio via URL — mesmo caminho do 12o.
    await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

    // 3a. Evento de switch emitido normalmente — carrinho vazio NÃO
    //     pode silenciar o funil (o vendedor trocou de empresa, ponto).
    await waitForEventSequence(page, [EVT_SWITCHED], {
      timeout: 6_000,
      label: "switch-to-empty",
    });
    const afterSwitch = await readAnalyticsEvents(page);
    const switched = afterSwitch.filter(
      (e) =>
        e.name === EVT_SWITCHED &&
        (e.payload as { toCartId?: string }).toCartId === cartB.id,
    );
    expect(
      switched.length,
      `esperava 1 cart.company_switched para cartB vazio, veio ${switched.length}`,
    ).toBe(1);
    const payload = switched[0]!.payload as {
      fromCartId: string | null;
      toCartId: string;
      source: string;
    };
    expect(payload.source).toBe("seller_carts_page");
    expect(payload.fromCartId).toBe(cartA.id);
    expect(payload.toCartId).toBe(cartB.id);

    // 3b. Nem selector nem company picker devem ter aparecido — o fluxo
    //     não pode reagir a "carrinho vazio" abrindo diálogo de seleção.
    await expect(
      page.locator(SEL_SELECTOR_DIALOG).first(),
      "cart-selector-dialog NÃO pode abrir só porque o carrinho está vazio",
    ).toBeHidden({ timeout: 2_000 });
    await expect(
      page.locator(SEL_COMPANY_PICKER).first(),
      "cart-company-picker-select NÃO pode abrir só porque o carrinho está vazio",
    ).toBeHidden({ timeout: 2_000 });

    // 4. Header CTA do cartB vazio: presente, mas bloqueado.
    const cta = page.locator(SEL_CHECKOUT_CTA).first();
    await expect(
      cta,
      "cart-checkout-cta deve renderizar mesmo com carrinho vazio (só bloqueado)",
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      cta,
      "cart-checkout-cta DEVE estar disabled quando o carrinho está vazio",
    ).toBeDisabled();
    const ariaDisabled = await cta.getAttribute("aria-disabled");
    expect(
      ariaDisabled,
      "aria-disabled=true é obrigatório para a11y quando o CTA está bloqueado",
    ).toBe("true");
    const title = (await cta.getAttribute("title")) ?? "";
    expect(
      title.toLowerCase(),
      `title do CTA deveria explicar o bloqueio; veio "${title}"`,
    ).toContain("adicione itens");

    // 4b. Force-click para provar que nem via bypass o handler dispara.
    await cta.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    expect(
      page.url(),
      "URL não pode mudar para /orcamentos/novo a partir de carrinho vazio",
    ).not.toMatch(/\/orcamentos\/novo/i);
    const eventsAfterForce = await readAnalyticsEvents(page);
    const finalizedBadly = eventsAfterForce.filter(
      (e) =>
        e.name === EVT_FINALIZED &&
        (e.payload as { cartId?: string }).cartId === cartB.id,
    );
    expect(
      finalizedBadly.length,
      "cart.quote_finalized NÃO pode ser emitido para carrinho vazio",
    ).toBe(0);

    // 5. Row menu de cartB na lista — Radix marca item com data-disabled.
    await gotoAndSettle(page, "/carrinhos");
    const moreBtn = page.locator(TID(`cart-row-more-${cartB.id}`)).first();
    await expect(
      moreBtn,
      "menu '...' do cartB deve estar visível na lista",
    ).toBeVisible({ timeout: 5_000 });
    await moreBtn.click();
    const rowMenuGenerate = page
      .locator(TID(`cart-row-menu-generate-quote-${cartB.id}`))
      .first();
    await expect(rowMenuGenerate).toBeVisible({ timeout: 3_000 });
    const dataDisabled = await rowMenuGenerate.getAttribute("data-disabled");
    expect(
      dataDisabled,
      "item 'Orçamento' do row menu DEVE ter data-disabled para cartB vazio",
    ).not.toBeNull();

    // Force-click no item desabilitado — Radix deve ignorar.
    await rowMenuGenerate.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    expect(
      page.url(),
      "URL não pode ter navegado para /orcamentos/novo pelo row menu",
    ).not.toMatch(/\/orcamentos\/novo/i);
    const eventsAfterRow = await readAnalyticsEvents(page);
    const finalizedFromRow = eventsAfterRow.filter(
      (e) =>
        e.name === EVT_FINALIZED &&
        (e.payload as { cartId?: string }).cartId === cartB.id,
    );
    expect(
      finalizedFromRow.length,
      "cart.quote_finalized NÃO pode ser emitido pelo row menu do carrinho vazio",
    ).toBe(0);
    await page.keyboard.press("Escape").catch(() => {});

    // 6. Sanity: cartA (com itens) continua finalizável — regressão geral.
    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await resetAnalyticsBuffer(page);
    await finalizeActiveCart(
      page,
      cartA,
      { navigate: false, label: "sanity-cartA" },
    );
  });
});
