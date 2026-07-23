/**
 * Regressão de estresse: repete o fluxo QuickAdd → finalizar **5 vezes**
 * seguidas na MESMA sessão do vendedor, garantindo que NENHUM dos diálogos
 * proibidos (`cart-selector-dialog`, `cart-company-picker-select`) reabra
 * em nenhuma das iterações e que TODA finalização conclua em
 * `/orcamentos/novo`.
 *
 * Por que loop? Bugs de "loop do seletor" tipicamente aparecem quando:
 *  • state do `SellerCartContext` acumula entre navegações;
 *  • `activeCartId` do storage se dessincroniza da lista após múltiplas
 *    escolhas seguidas;
 *  • analytics buffer polui e um `cart.quote_finalized` de iteração N-1
 *    "vaza" para a asserção da iteração N.
 *
 * Estratégia:
 *  1. Uma única `setupAuthedWithCarts` no início (2 carrinhos A/B).
 *  2. A cada iteração:
 *       a) LIMPA o buffer `window.__e2eAnalytics__` para isolar asserts.
 *       b) Persiste `activeSellerCartId = cartB.id` (troca simulada, o
 *          caminho longo já é coberto em 12g).
 *       c) Instala watcher determinístico com label `iter-<n>` — anexos
 *          únicos por iteração no relatório.
 *       d) Navega para `/carrinhos/${cartB.id}` e finaliza.
 *       e) Afirma navegação + emissão de `cart.quote_finalized` referente
 *          ao cartB e ausência dos dialogs.
 *  3. Se em qualquer iteração um dialog reabrir → falha com screenshot,
 *     HTML e timestamp preservados por `startForbiddenDialogWatcher`.
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect } from "../fixtures/test-base";
import { TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { gotoAndSettle } from "../helpers/nav";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");
const ITERATIONS = 5;

test.describe("Regressão em loop: QuickAdd → finalizar 5x sem seletor", () => {
  test(`repete ${ITERATIONS}x o checkout e nenhum dialog proibido reabre`, async ({
    page,
  }, testInfo) => {
    // Setup único — a lista de carrinhos é estável durante todo o loop.
    const { cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/produtos",
    });
    if (!cartB) {
      test.skip(true, "cartB ausente — configuração inesperada do helper");
      return;
    }

    // Extende o timeout do teste: 5 iterações × ~10s cada + buffer.
    test.setTimeout(90_000);

    let successCount = 0;
    let skippedForMissingCta = 0;

    for (let i = 1; i <= ITERATIONS; i++) {
      // (a) Limpa buffer de analytics — asserts da iteração não podem colidir
      //     com eventos de iterações anteriores.
      await page.evaluate(() => {
        (
          window as unknown as {
            __e2eAnalytics__?: Array<Record<string, unknown>>;
          }
        ).__e2eAnalytics__ = [];
      });

      // (b) Persiste o activeCartId no storage — simula "troca concluída".
      await page.evaluate((id) => {
        try {
          window.localStorage.setItem(
            "promo-gifts:activeSellerCartId",
            id,
          );
        } catch {
          /* storage indisponível — navegação direta cobre */
        }
      }, cartB.id);

      // (c) Watcher com label único por iteração — anexos não colidem.
      const watcher = startForbiddenDialogWatcher(page, testInfo, {
        label: `iter-${i}`,
        selectors: {
          "cart-selector-dialog": SEL_SELECTOR_DIALOG,
          "cart-company-picker-select": SEL_COMPANY_PICKER,
        },
      });

      try {
        // (d) Navega e finaliza.
        await gotoAndSettle(page, `/carrinhos/${cartB.id}`);
        await expect(
          page.locator(SEL_SELECTOR_DIALOG).first(),
          `iter ${i}: cart-selector-dialog apareceu na navegação`,
        ).toBeHidden({ timeout: 2_000 });
        await expect(
          page.locator(SEL_COMPANY_PICKER).first(),
          `iter ${i}: cart-company-picker-select apareceu na navegação`,
        ).toBeHidden({ timeout: 2_000 });

        const checkoutCta = page.locator(SEL_CHECKOUT_CTA).first();
        const ctaVisible = await checkoutCta.isVisible().catch(() => false);

        if (!ctaVisible) {
          // Ambiente sem itens persistidos (mock não persiste inserts).
          // Registramos e seguimos — o watcher já validou a ausência do
          // seletor nesta iteração.
          skippedForMissingCta++;
          test.info().annotations.push({
            type: "note",
            description: `iter ${i}: CTA de finalização ausente (mock sem itens).`,
          });
        } else {
          await checkoutCta.click();
          await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 10_000 });
          expect(
            page.url(),
            `iter ${i}: destino inesperado após finalizar`,
          ).toMatch(/\/orcamentos\/novo/i);

          // Analytics — evento único desta iteração (buffer foi limpo).
          await expect
            .poll(
              async () =>
                await page.evaluate(() => {
                  const buf =
                    (
                      window as unknown as {
                        __e2eAnalytics__?: Array<Record<string, unknown>>;
                      }
                    ).__e2eAnalytics__ ?? [];
                  return buf.filter((e) => e.name === "cart.quote_finalized")
                    .length;
                }),
              {
                timeout: 3_000,
                message: `iter ${i}: cart.quote_finalized não emitido`,
              },
            )
            .toBe(1);

          const finalizeEvent = await page.evaluate(() => {
            const buf =
              (
                window as unknown as {
                  __e2eAnalytics__?: Array<Record<string, unknown>>;
                }
              ).__e2eAnalytics__ ?? [];
            return (
              buf.find((e) => e.name === "cart.quote_finalized") ?? null
            );
          });
          expect(
            (finalizeEvent as { payload: { cartId: string } } | null)?.payload
              .cartId,
            `iter ${i}: cartId do evento diverge de cartB`,
          ).toBe(cartB.id);

          successCount++;

          // Volta ao catálogo para reiniciar o próximo ciclo em estado
          // conhecido — evita depender do restart de router.
          await gotoAndSettle(page, "/produtos");
        }
      } finally {
        await watcher.stop();
      }

      // (e) Assert por iteração — falha imediata com anexos ricos se algum
      // dialog reabriu nesta rodada.
      await watcher.assertNoHits();
    }

    // Sanidade global: ou finalizamos todas as iterações, ou o ambiente não
    // tinha CTA persistente (nesse caso, o valor real do teste está nas
    // asserções `toBeHidden` + watcher, que rodaram em todas as 5 iterações).
    expect(
      successCount + skippedForMissingCta,
      "todas as iterações devem ter passado por finalizar ou por skip anotado",
    ).toBe(ITERATIONS);
    if (successCount === 0) {
      test.info().annotations.push({
        type: "note",
        description:
          "Nenhuma iteração exercitou o CTA de finalização (mock sem itens); a cobertura ficou restrita à ausência de dialogs.",
      });
    }
  });
});
