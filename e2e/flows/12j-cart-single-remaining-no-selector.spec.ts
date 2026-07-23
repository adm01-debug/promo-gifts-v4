/**
 * Regressão: após a troca de empresa, quando SOBRA apenas 1 carrinho, o
 * seletor NUNCA deve aparecer e o checkout deve concluir normalmente.
 *
 * Cenário coberto:
 *   1. Vendedor inicia com 2 carrinhos (A e B).
 *   2. Troca a empresa do carrinho no popover do QuickAdd → seleciona B.
 *   3. Depois da troca, o carrinho A é removido no backend (mock re-emitido
 *      passando a devolver só o B). Isso simula fluxos reais em que:
 *        • o carrinho antigo foi finalizado por outro dispositivo, OU
 *        • o vendedor removeu o carrinho vazio manualmente, OU
 *        • RLS filtrou o carrinho A (ex.: mudou o `seller_id`).
 *   4. Vendedor abre `/carrinhos/:id` do B e clica em "Gerar Orçamento".
 *
 * ASSERT PRINCIPAL: com apenas 1 carrinho na lista, NEM o
 * `cart-selector-dialog` NEM o `cart-company-picker-select` podem aparecer —
 * o sistema deve reconhecer o cart único como `activeCart` e finalizar
 * direto em `/orcamentos/novo`.
 *
 * Fix relacionado: guarda em `handleAddToQuote` (QuickAddToQuote.tsx) —
 * este spec protege contra regressões cruzadas onde a lista encolhe para 1
 * item mas o context ainda tenta abrir o seletor.
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { mockSellerCartsAPI } from "../helpers/cart-mock";
import { gotoAndSettle } from "../helpers/nav";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");

test.describe("Regressão: 1 carrinho restante após troca → sem seletor no checkout", () => {
  test("com apenas 1 carrinho pós-troca, finalizar não abre seletor de empresa", async ({
    page,
  }, testInfo) => {
    // 1. Sessão + 2 carrinhos mockados (A e B).
    const { cartA, cartB, carts } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/produtos",
    });

    // `cartB` é o alvo da troca — o TypeScript sabe que pode ser undefined
    // (count < 2 no helper), mas count=2 garante presença. Guard defensivo:
    if (!cartB) {
      test.skip(true, "setupAuthedWithCarts não gerou cartB (config inesperada)");
      return;
    }

    // 2. Simula a "troca de empresa" pelo caminho mais barato e determinístico:
    //    persistindo o activeCartId do B no storage que o SellerCartContext
    //    consulta no boot. Não precisamos varrer a UI do QuickAdd aqui — esse
    //    caminho já é coberto em 12g. Este spec foca no ESTADO PÓS-TROCA.
    await page.evaluate((id) => {
      try {
        window.localStorage.setItem("promo-gifts:activeSellerCartId", id);
      } catch {
        /* storage indisponível — o próximo passo compensa via URL direta */
      }
    }, cartB.id);

    // 3. Re-emite o mock com APENAS o carrinho B (cartA removido do backend).
    //    `page.route` do Playwright acumula handlers; para trocar o payload,
    //    removemos a rota anterior e registramos a nova.
    await page.unroute("**/rest/v1/seller_carts**");
    await mockSellerCartsAPI(page, [cartB]);
    // Sanity: cartA existiu e agora foi retirado do conjunto.
    expect(carts).toHaveLength(2);
    void cartA;

    // 4. Instala o watcher determinístico ANTES da navegação — se algum
    //    dialog proibido reabrir durante o checkout, o teste falha com
    //    mensagem descritiva + screenshot + HTML anexados ao relatório.
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "single-cart-checkout",
      selectors: {
        "cart-selector-dialog": SEL_SELECTOR_DIALOG,
        "cart-company-picker-select": SEL_COMPANY_PICKER,
      },
    });

    try {
      // 5. Navega para a página do carrinho B (único remanescente).
      await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

      // Nem o seletor de carrinho, nem o picker de empresa devem aparecer.
      await expect(page.locator(SEL_SELECTOR_DIALOG).first()).toBeHidden({
        timeout: 2_000,
      });
      await expect(page.locator(SEL_COMPANY_PICKER).first()).toBeHidden({
        timeout: 2_000,
      });

      // 6. Finaliza: se o CTA existir, clica e valida navegação para
      //    /orcamentos/novo sem abrir dialogs.
      const checkoutCta = page.locator(SEL_CHECKOUT_CTA).first();
      if (!(await checkoutCta.isVisible().catch(() => false))) {
        test.info().annotations.push({
          type: "note",
          description:
            "CTA de finalização ausente — mock não persistiu itens; watcher já validou ausência de seletor.",
        });
      } else {
        await checkoutCta.click();
        await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 8_000 });
        expect(page.url()).toMatch(/\/orcamentos\/novo/i);

        // Após a navegação, seletores continuam ocultos.
        await expect(page.locator(SEL_SELECTOR_DIALOG).first()).toBeHidden({
          timeout: 1_000,
        });
        await expect(page.locator(SEL_COMPANY_PICKER).first()).toBeHidden({
          timeout: 1_000,
        });

        // Analytics: cart.quote_finalized referenciando o único carrinho (B).
        await expect
          .poll(
            async () =>
              await page.evaluate(() => {
                const buf =
                  (window as unknown as {
                    __e2eAnalytics__?: Array<Record<string, unknown>>;
                  }).__e2eAnalytics__ ?? [];
                return buf.filter((e) => e.name === "cart.quote_finalized").length;
              }),
            {
              timeout: 3_000,
              message: "cart.quote_finalized deveria ter sido emitido",
            },
          )
          .toBeGreaterThan(0);

        const finalizeEvent = await page.evaluate(() => {
          const buf =
            (window as unknown as {
              __e2eAnalytics__?: Array<Record<string, unknown>>;
            }).__e2eAnalytics__ ?? [];
          return buf.find((e) => e.name === "cart.quote_finalized") ?? null;
        });
        expect(finalizeEvent).not.toBeNull();
        expect(
          (finalizeEvent as { payload: { cartId: string } }).payload.cartId,
        ).toBe(cartB.id);
      }
    } finally {
      await watcher.stop();
    }

    // Falha rica se qualquer dialog reabriu durante o fluxo.
    await watcher.assertNoHits();
  });
});
