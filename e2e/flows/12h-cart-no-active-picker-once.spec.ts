/**
 * Regressão complementar ao 12g: cenário SEM `activeCart` pré-definido.
 *
 * Objetivo: garantir que, quando o vendedor abre o QuickAdd e ainda não há
 * carrinho ativo escolhido, o seletor de carrinho aparece EXATAMENTE UMA VEZ,
 * a seleção fecha o modal, e o fluxo de finalização em /carrinhos/:id não
 * reabre nenhum seletor (CartSelectorDialog nem CartCompanyPickerDialog).
 *
 * Diferença vs 12g:
 *   - 12g cobre o caminho pós-troca (activeCart já existe, veio de uma troca).
 *   - 12h cobre o caminho inicial (activeCart == null), onde o seletor DEVE abrir.
 *
 * Política SSOT: apenas data-testid via Sel/TID. Skip tolerante em ambientes
 * sem catálogo — igual ao padrão do 12g.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { mockSellerCartsAPI, makeMockCart } from "../helpers/cart-mock";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_CHECKOUT_CTA = TID("cart-checkout-cta");

test.describe("Regressão: sem activeCart, seletor abre 1x e finalização não faz loop", () => {
  test.beforeEach(() => requireAuth());

  test("seletor abre apenas uma vez ao adicionar e checkout conclui sem reabrir", async ({
    page,
  }) => {
    // Semeia 2 carrinhos SEM tocar em qualquer preferência de activeCart —
    // o SellerCartContext resolve `activeCart` como null até uma seleção
    // explícita do usuário.
    const cartA = makeMockCart(0, 1);
    const cartB = makeMockCart(1, 1);
    await mockSellerCartsAPI(page, [cartA, cartB]);

    await gotoAndSettle(page, "/produtos");

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

    // Contador de aberturas do seletor — precisa ser exatamente 1 no fim.
    const selectorDialog = page.locator(SEL_SELECTOR_DIALOG).first();
    const companyPicker = page.locator(SEL_COMPANY_PICKER).first();
    let selectorOpenCount = 0;
    let pickerOpenCount = 0;
    let lastSelectorVisible = false;
    let lastPickerVisible = false;

    const tick = async () => {
      const [sel, pick] = await Promise.all([
        selectorDialog.isVisible().catch(() => false),
        companyPicker.isVisible().catch(() => false),
      ]);
      if (sel && !lastSelectorVisible) selectorOpenCount += 1;
      if (pick && !lastPickerVisible) pickerOpenCount += 1;
      lastSelectorVisible = sel;
      lastPickerVisible = pick;
    };
    const watcher = setInterval(() => {
      void tick();
    }, 100);

    try {
      await cartTrigger.click();

      const addBtn = page.locator(Sel.product.cardAddToCart).first();
      const first = await Promise.race([
        addBtn.waitFor({ state: "visible", timeout: 8_000 }).then(() => "quantity"),
        selectorDialog.waitFor({ state: "visible", timeout: 8_000 }).then(() => "selector"),
      ]).catch(() => null);

      if (!first) {
        test.skip(true, "Popover do QuickAdd não abriu (variante obrigatória neste card)");
        return;
      }

      // Se o popover aparecer com um activeCart resolvido (ambientes onde há
      // um "último carrinho" persistido), forçamos o seletor via "Trocar" —
      // mantemos o cenário determinístico.
      if (first === "quantity") {
        const trocar = page.getByRole("button", { name: /^trocar$/i }).first();
        if (!(await trocar.isVisible().catch(() => false))) {
          test.skip(true, "Ambiente com activeCart persistido — cenário coberto pelo 12g");
          return;
        }
        await trocar.click();
      }

      await expect(selectorDialog).toBeVisible({ timeout: 8_000 });

      // Seleciona o carrinho A — fluxo inicial (não é uma troca).
      const cartARow = page.locator(TID(`cart-selector-item-${cartA.id}`)).first();
      await expect(cartARow).toBeVisible({ timeout: 5_000 });
      await cartARow.click();

      // Após a escolha, o seletor DEVE fechar e não reabrir sozinho.
      await expect(selectorDialog).toBeHidden({ timeout: 5_000 });

      // Sanity: da abertura até fechar, contamos 1 subida de borda.
      // Aguarda o watcher registrar o estado final antes das asserções.
      await page.waitForTimeout(300);

      // Etapa de finalização: navega para /carrinhos/:id e clica no CTA.
      await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
      await expect(selectorDialog).toBeHidden({ timeout: 1_000 });
      await expect(companyPicker).toBeHidden({ timeout: 1_000 });

      const checkoutCta = page.locator(SEL_CHECKOUT_CTA).first();
      if (!(await checkoutCta.isVisible().catch(() => false))) {
        test.info().annotations.push({
          type: "note",
          description: "CTA de finalização ausente — mock não persistiu itens.",
        });
      } else {
        await checkoutCta.click();
        await page.waitForURL(/\/orcamentos\/novo/i, { timeout: 8_000 });
        expect(page.url()).toMatch(/\/orcamentos\/novo/i);
      }

      // Garante que o watcher registrou o estado final.
      await page.waitForTimeout(200);
    } finally {
      clearInterval(watcher);
    }

    // Invariantes finais:
    // - o seletor de carrinho abriu no MÁXIMO uma vez em todo o fluxo
    //   (0 é possível se o ambiente entregou o popover em modo activeCart
    //   e o teste foi skipado antes; aqui já asseguramos >=1 pelo expect visible acima).
    expect(
      selectorOpenCount,
      "CartSelectorDialog deve abrir EXATAMENTE 1x no fluxo sem activeCart",
    ).toBe(1);
    // - o picker de empresa NUNCA deve aparecer neste fluxo (só é usado ao
    //   criar carrinho novo a partir do próprio picker, não daqui).
    expect(
      pickerOpenCount,
      "CartCompanyPickerDialog não deve abrir no fluxo QuickAdd → finalizar",
    ).toBe(0);
  });
});
