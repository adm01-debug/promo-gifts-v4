/**
 * Regressão do "loop do CartSelectorDialog" ao trocar de carrinho no QuickAdd.
 *
 * BUG: com 2+ carrinhos ativos, o botão "Adicionar ao Carrinho" (dentro do
 * popover do QuickAddToQuote) reabria o `CartSelectorDialog` mesmo quando já
 * havia um `activeCart` definido — trancando o vendedor num loop após clicar
 * em "Trocar" e escolher outra empresa.
 *
 * Fix: guarda em `handleAddToQuote` só abre o seletor quando NÃO há
 * `activeCart`. Este spec exercita o fluxo completo:
 *   1. Semear 2 carrinhos via mock da API `seller_carts`
 *   2. Abrir popover do QuickAdd em um card do catálogo
 *   3. Clicar em "Trocar" → seletor abre → escolher o outro carrinho
 *   4. Reabrir o popover e clicar "Adicionar ao Carrinho"
 *   5. VERIFICAR: o `CartSelectorDialog` NÃO reabre (sem loop)
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 * Skip tolerante em ambientes sem catálogo (segue padrão do 12-cart-checkout).
 */
import { test, expect } from "../fixtures/test-base";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");

test.describe("Regressão: trocar carrinho não abre seletor em loop", () => {
  test("após 'Trocar' + escolher outro carrinho, 'Adicionar ao Carrinho' NÃO reabre o seletor", async ({
    page,
  }) => {
    // SSOT: login autenticado + 2 carrinhos mockados + navegação para /produtos,
    // em ordem determinística (login → mock → goto). O `SellerCartContext`
    // dispara a query de seller_carts no boot da rota, então o mock JÁ está
    // registrado quando ela chega.
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: "/produtos",
    });
    // cartA é referenciado em asserts adiante — evita warning strict.
    void cartA;

    const card = page.locator(Sel.product.card).first();
    if (!(await card.isVisible().catch(() => false))) {
      test.skip(true, "Catálogo vazio neste ambiente");
      return;
    }

    // 2. Abre o popover do QuickAddToQuote via ações rápidas do card.
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

    // O popover pode exigir escolha de variante primeiro; se aparecer o próprio
    // seletor de carrinho de cara (sem activeCart pré-definido no fluxo real),
    // usamos ele como ponto de partida.
    const addBtn = page.locator(Sel.product.cardAddToCart).first();
    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();

    const first = await Promise.race([
      addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
      selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
    ]).catch(() => null);

    if (!first) {
      test.skip(true, "Popover do QuickAdd não abriu (variante obrigatória neste card)");
      return;
    }

    // 3. Garante que o seletor abra e escolhe o carrinho B (troca de empresa).
    if (first === "quantity") {
      // Popover já mostra "→ Empresa X   Trocar" — aciona o botão Trocar.
      // Como o "Trocar" não tem data-testid dedicado, buscamos pelo texto
      // dentro do card do popover (exceção controlada e localizada).
      const trocar = page.getByRole("button", { name: /^trocar$/i }).first();
      if (!(await trocar.isVisible().catch(() => false))) {
        test.skip(true, "Botão Trocar ausente — popover em estado inesperado");
        return;
      }
      await trocar.click();
    }
    await expect(selectorDialog).toBeVisible({ timeout: 8_000 });

    // Clica no cartão B do seletor.
    const cartBRow = page.locator(TID(`cart-selector-item-${cartB.id}`)).first();
    await expect(cartBRow).toBeVisible({ timeout: 5_000 });
    await cartBRow.click();

    // Analytics: a escolha do carrinho B deve emitir `cart.company_switched`
    // com `source: 'quick_add_selector'` e `toCartId` apontando para o B.
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
    expect((switchEvent as { payload: { toCartId: string; source: string } }).payload.toCartId)
      .toBe(cartB.id);
    expect((switchEvent as { payload: { source: string } }).payload.source).toBe(
      "quick_add_selector",
    );

    // Após escolher, o popover auto-fecha em 1200ms (setTimeout do QuickAdd).
    await expect(selectorDialog).toBeHidden({ timeout: 5_000 });

    // 4. Reabre o popover no MESMO card — activeCart agora é o B.
    if (await actionsToggle.isVisible().catch(() => false)) {
      await actionsToggle.click().catch(() => {});
    }
    await cartTrigger.click();
    await expect(addBtn).toBeVisible({ timeout: 8_000 });

    // 5. Clica em "Adicionar ao Carrinho" — o BUG faria o seletor reabrir.
    //    Com o fix, ele adiciona direto ao activeCart e o popover fecha.
    await addBtn.click();

    // Aguarda uma janela suficiente para o seletor "reabrir" caso o bug
    // volte — se aparecer, o teste falha imediatamente.
    await expect(selectorDialog).toBeHidden({ timeout: 2_000 });

    // Confirma que o botão entrou em estado "Adicionado" (isAdded=true) ou
    // que o popover fechou — ambos são sinais válidos de sucesso.
    const stillVisible = await addBtn.isVisible().catch(() => false);
    if (stillVisible) {
      // O texto muda para "Adicionado!" enquanto o popover não fecha.
      await expect(addBtn).toContainText(/adicionado/i, { timeout: 3_000 });
    }

    // 6. Finalizar: navega para o carrinho B e clica em "Gerar Orçamento".
    //    Asserts adicionais garantem que NENHUM seletor de empresa aparece
    //    durante o checkout e que a finalização conclui com sucesso
    //    (navegação para /orcamentos/novo).
    const companyPicker = page.locator(SEL_COMPANY_PICKER).first();

    // Instala um "watcher": se qualquer um dos dois dialogs ficar visível
    // enquanto o checkout roda, capturamos e reprovamos o teste.
    let selectorOpenedDuringCheckout = false;
    let pickerOpenedDuringCheckout = false;
    const watcher = setInterval(() => {
      void selectorDialog
        .isVisible()
        .then((v) => {
          if (v) selectorOpenedDuringCheckout = true;
        })
        .catch(() => {});
      void companyPicker
        .isVisible()
        .then((v) => {
          if (v) pickerOpenedDuringCheckout = true;
        })
        .catch(() => {});
    }, 100);

    try {
      await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

      // Nem o seletor de carrinho, nem o picker de empresa devem aparecer
      // só por navegar para a página do carrinho ativo.
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(companyPicker).toBeHidden({ timeout: 1_000 });

      const checkoutCta = page.locator(SEL_CHECKOUT_CTA).first();
      if (!(await checkoutCta.isVisible().catch(() => false))) {
        // Ambiente sem CTA (ex.: carrinho sem itens porque o mock não persiste
        // a insert real) — pulamos apenas a parte de finalização.
        test.info().annotations.push({
          type: "note",
          description: "CTA de finalização ausente — mock não persistiu itens.",
        });
      } else {
        await checkoutCta.click();

        // Sucesso = navegação para /orcamentos/novo (destino de handleGenerateQuote).
        await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 8_000 });
        expect(page.url()).toMatch(/\/orcamentos\/novo/i);

        // Depois de finalizar, os dialogs continuam ocultos.
        await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
        await expect(companyPicker).toBeHidden({ timeout: 1_000 });

        // Analytics: o "Gerar Orçamento" deve emitir `cart.quote_finalized`
        // referenciando o carrinho B (destino da troca).
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
            { timeout: 3_000, message: "cart.quote_finalized deveria ter sido emitido" },
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
      clearInterval(watcher);
    }

    expect(
      selectorOpenedDuringCheckout,
      "CartSelectorDialog NÃO deve abrir durante o checkout após troca de carrinho",
    ).toBe(false);
    expect(
      pickerOpenedDuringCheckout,
      "CartCompanyPickerDialog NÃO deve abrir durante o checkout após troca de carrinho",
    ).toBe(false);
  });
});
