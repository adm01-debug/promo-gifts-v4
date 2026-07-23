/**
 * 12w — Espelho de 12u (rate limit 429) na troca de empresa via
 * navegação lateral (SellerCartsPage).
 *
 * Fecha o gap deixado pelas séries 12o (sidebar, happy path) e 12u
 * (rate limit, mas via QuickAdd/produtos). A troca lateral não faz
 * mutation por si só — é apenas `setActiveCartId` + navigate — então
 * o rate limit é aplicado ao POST subsequente em `seller_cart_items`,
 * que é o próximo passo natural do vendedor: após pular para outro
 * carrinho pela lista, ele volta ao catálogo e tenta adicionar um
 * produto ao carrinho recém-ativado.
 *
 * Contrato validado
 * -----------------
 *   1. A troca sidebar A→B emite `cart.company_switched` com
 *      `source='seller_carts_page'` (exatamente 1 evento).
 *   2. Após a troca, um POST em `/rest/v1/seller_cart_items` que
 *      retorna 429 → toast SSOT `SELLER_CART_TOASTS.addItemError.title`
 *      com a description canônica de rate limit
 *      ("Muitas tentativas. Aguarde alguns minutos e tente novamente.").
 *   3. `CartSelectorDialog` NÃO abre em momento algum (o watcher
 *      falha o teste se detectar hit). Guarda o gap real: se alguém
 *      trocar o fluxo do sidebar para reabrir o dialog em falha, este
 *      teste quebra antes de chegar à produção.
 *   4. Empresa ativa no header permanece `cartB.company_name` — a
 *      troca lateral já foi persistida na aba antes do erro; o 429 do
 *      add NÃO deve reverter o `activeCartId` para `cartA` nem
 *      esvaziar o header.
 *   5. Não há cascata de retries — POSTs em `seller_cart_items` ≤ 2.
 *
 * Política SSOT (e2e/fixtures/selectors.ts) — apenas data-testid.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel, TID } from "../fixtures/selectors";
import { setupAuthedWithCarts } from "../helpers/cart-setup";
import { startForbiddenDialogWatcher } from "../helpers/dialog-watcher";
import { assertCartAddErrorToast } from "../helpers/cart-toast-assertions";
import {
  readAnalyticsEvents,
  resetAnalyticsBuffer,
  waitForEventSequence,
} from "../helpers/analytics";
import { SELLER_CART_TOASTS } from "../../src/hooks/products/sellerCartToasts";

const SEL_SELECTOR_DIALOG = TID("cart-selector-dialog");
const SEL_COMPANY_PICKER = TID("cart-company-picker-select");
const SEL_ACTIVE_COMPANY = TID("active-cart-company-name");
const RATE_LIMITED_COPY = /muitas tentativas\.\s*aguarde/i;
const EVT_SWITCHED = "cart.company_switched";

test.describe("Regressão: 429 na troca lateral (SellerCartsPage)", () => {
  test.beforeEach(() => requireAuth());

  test("sidebar A→B + POST 429 → toast SSOT; sem loop; cartB preservado", async ({
    page,
  }, testInfo) => {
    // ------------------------------------------------------------------
    // Fase 0 — setup: 2 carrinhos, pousar em cartA, buffer limpo.
    // ------------------------------------------------------------------
    const { cartA, cartB } = await setupAuthedWithCarts(page, {
      count: 2,
      itemsPerCart: 1,
      gotoUrl: null,
    });
    if (!cartB) throw new Error("setupAuthedWithCarts count=2 deveria gerar cartB");
    expect(cartA.company_name).not.toBe(cartB.company_name);

    await gotoAndSettle(page, `/carrinhos/${cartA.id}`);
    await resetAnalyticsBuffer(page);

    // ------------------------------------------------------------------
    // Fase 1 — troca lateral: navega para /carrinhos/:cartB. Mesma
    // semântica do clique num card da lista (o handler é o mesmo effect
    // em useSellerCartsPage.ts que roda em toda mudança do route param).
    // ------------------------------------------------------------------
    const watcher = startForbiddenDialogWatcher(page, testInfo, {
      label: "12w-sidebar-429",
      selectors: {
        selector_dialog: SEL_SELECTOR_DIALOG,
        company_picker: SEL_COMPANY_PICKER,
      },
    });

    try {
      await gotoAndSettle(page, `/carrinhos/${cartB.id}`);

      await waitForEventSequence(page, [EVT_SWITCHED], {
        timeout: 6_000,
        label: "12w-sidebar-switch",
      });

      const eventsAfterSwitch = await readAnalyticsEvents(page);
      const switched = eventsAfterSwitch.filter((e) => e.name === EVT_SWITCHED);
      expect(
        switched.length,
        `esperava 1 cart.company_switched na troca lateral, veio ${switched.length}`,
      ).toBe(1);
      const switchPayload = switched[0]!.payload as {
        source: string;
        fromCartId: string | null;
        toCartId: string;
      };
      expect(switchPayload.source).toBe("seller_carts_page");
      expect(switchPayload.fromCartId).toBe(cartA.id);
      expect(switchPayload.toCartId).toBe(cartB.id);

      // Header já reflete cartB antes de qualquer add.
      await expect(page.locator(SEL_ACTIVE_COMPANY).first()).toContainText(
        cartB.company_name,
        { timeout: 3_000 },
      );

      // ----------------------------------------------------------------
      // Fase 2 — arma o intercept 429 e volta ao catálogo para tentar
      // adicionar um produto ao carrinho ativo (cartB). Este é o caminho
      // que dispara a mutation real; a troca em si não faz HTTP.
      // ----------------------------------------------------------------
      let insertAttempts = 0;
      await page.route(/\/rest\/v1\/seller_cart_items(\?|$)/i, async (route) => {
        if (route.request().method() !== "POST") {
          await route.fallback();
          return;
        }
        insertAttempts += 1;
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30",
          },
          body: JSON.stringify({
            code: "rate_limited",
            message: "Too Many Requests",
            details: null,
            hint: null,
          }),
        });
      });

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
      await cartTrigger.click();

      // Como cartB já é o ativo (persistido pela troca lateral), o
      // QuickAdd deve ir direto ao popover de quantidade — NÃO ao
      // CartSelectorDialog. Se cair no dialog, o watcher captura.
      const addBtn = page.locator(Sel.product.cardAddToCart).first();
      await expect(
        addBtn,
        "QuickAdd deve abrir direto no botão Adicionar; se abrir o CartSelectorDialog, há regressão da troca lateral",
      ).toBeVisible({ timeout: 8_000 });
      await addBtn.click();

      // ----------------------------------------------------------------
      // Fase 3 — asserts do contrato 429 (espelham 12u).
      // ----------------------------------------------------------------
      // 3a. Toast canônico do SSOT `sellerCartToasts`.
      await assertCartAddErrorToast(page, { expectAutoDismiss: false });

      // 3b. Description precisa ser a cópia pública de rate limit.
      const errorToast = page
        .locator('[data-sonner-toast][data-type="error"]')
        .filter({ hasText: SELLER_CART_TOASTS.addItemError.title })
        .first();
      await expect(
        errorToast,
        "Toast deve carregar a cópia SSOT de rate limit (drift de sanitize-error quebra aqui)",
      ).toContainText(RATE_LIMITED_COPY, { timeout: 3_000 });

      // 3c. Sem cascata de retries.
      expect(
        insertAttempts,
        `Rate limit NÃO deve disparar cascata; POSTs=${insertAttempts}`,
      ).toBeLessThanOrEqual(2);
      expect(insertAttempts, "POST em seller_cart_items precisa ter sido tentado").toBeGreaterThan(
        0,
      );

      // 3d. Nenhum novo `cart.company_switched` foi emitido pelo
      //     caminho de erro (a troca já foi feita pela sidebar; o 429
      //     do add não pode gerar segundo switch nem reverter estado).
      const eventsAfterFailure = await readAnalyticsEvents(page);
      const switchedAfter = eventsAfterFailure.filter((e) => e.name === EVT_SWITCHED);
      expect(
        switchedAfter.length,
        `429 no add NÃO pode disparar novo cart.company_switched (${switchedAfter.length}): ` +
          JSON.stringify(switchedAfter, null, 2),
      ).toBe(1);

      // 3e. Empresa ativa preservada como cartB — no header do carrinho.
      await gotoAndSettle(page, `/carrinhos/${cartB.id}`);
      await expect
        .poll(
          async () => (await page.locator(SEL_ACTIVE_COMPANY).first().textContent()) ?? "",
          { timeout: 2_000, intervals: [200, 300, 500] },
        )
        .toContain(cartB.company_name);

      // 3f. Diálogos proibidos permanecem escondidos.
      await expect(page.locator(SEL_SELECTOR_DIALOG)).toBeHidden({ timeout: 1_000 });
      await expect(page.locator(SEL_COMPANY_PICKER)).toBeHidden({ timeout: 1_000 });
    } finally {
      await watcher.assertNoHits();
    }
  });
});
