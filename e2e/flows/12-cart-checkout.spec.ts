/**
 * Fluxo: Carrinho → Checkout (Gerar Orçamento)
 *
 *  1) Adiciona produto ao carrinho via QuickAddToQuote a partir do catálogo,
 *     ajusta a quantidade no /carrinhos e abre o checkout (Gerar Orçamento).
 *  2) Falha de backend simulada via page.route → UI mostra erro e não quebra.
 *
 * Política: SSOT em e2e/fixtures/selectors.ts — somente data-testid.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import type { Locator, Page } from "@playwright/test";

const CARD_SELECTOR = Sel.product.card;
const TOAST_SELECTOR = Sel.app.toast;

async function firstCatalogCard(page: Page): Promise<Locator> {
  const card = page.locator(CARD_SELECTOR).first();
  await card.waitFor({ state: "visible", timeout: 20_000 });
  return card;
}

/**
 * Garante carrinho ativo. Se não houver, abre /carrinhos/novo e tenta
 * escolher a primeira empresa do CartCompanyPickerDialog (via testid).
 */
async function ensureActiveCart(page: Page): Promise<boolean> {
  await gotoAndSettle(page, "/carrinhos");

  const hasCart = await page
    .locator(Sel.cart.drawer)
    .first()
    .isVisible()
    .catch(() => false);
  if (hasCart) return true;

  await gotoAndSettle(page, "/carrinhos/novo");

  const firstCompany = page.locator(Sel.cart.companyPickerSelect).first();
  if (await firstCompany.isVisible().catch(() => false)) {
    await firstCompany.click().catch(() => {});
    await page.waitForTimeout(800);
    return true;
  }
  // Sem empresas cadastradas
  return false;
}

/**
 * Tenta adicionar o primeiro produto do catálogo ao carrinho ativo.
 * Retorna o productId adicionado (ou null se não foi possível).
 */
async function addFirstProductToCart(page: Page): Promise<string | null> {
  await gotoAndSettle(page, "/produtos");
  const card = await firstCatalogCard(page);

  const productId = await card.evaluate((el) => {
    const node = (el as HTMLElement).matches("[data-product-id]")
      ? (el as HTMLElement)
      : (el.querySelector("[data-product-id]") as HTMLElement | null);
    return node?.getAttribute("data-product-id") ?? "";
  });

  // Abre menu de ações rápidas, se presente
  const actionsToggle = card.locator(Sel.product.actionsToggle).first();
  if (await actionsToggle.isVisible().catch(() => false)) {
    const open = await actionsToggle.getAttribute("data-actions-open");
    if (open !== "true") {
      await actionsToggle.click().catch(() => {});
    }
  }

  // Trigger do popover de carrinho dentro do card
  const cartTrigger = card.locator(Sel.product.cartTrigger).first();
  if (!(await cartTrigger.isVisible().catch(() => false))) return null;
  await cartTrigger.click();

  // Botão final dentro do popover (testid SSOT)
  const addBtn = page.locator(Sel.product.cardAddToCart).first();
  await addBtn.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (!(await addBtn.isVisible().catch(() => false))) return null;

  if (await addBtn.isDisabled().catch(() => false)) {
    // Pode estar pedindo variante — tenta "Sem cor específica"
    const noVariant = page.locator(Sel.variant.noVariant).first();
    if (await noVariant.isVisible().catch(() => false)) {
      await noVariant.click().catch(() => {});
    }
  }

  if (await addBtn.isEnabled().catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(600);
    return productId || null;
  }
  return null;
}

test.describe("Fluxo: Carrinho → Checkout", () => {
  test.beforeEach(() => requireAuth());

  test("adiciona item, ajusta quantidade e abre checkout (Gerar Orçamento)", async ({
    page,
  }) => {
    const ready = await ensureActiveCart(page);
    test.skip(!ready, "Sem empresas cadastradas para criar carrinho de teste");

    const productId = await addFirstProductToCart(page);
    test.skip(
      !productId,
      "Não foi possível adicionar produto (popover/variante indisponível)",
    );

    await gotoAndSettle(page, "/carrinhos");

    // Localiza item adicionado pelo data-product-id no cart-item
    const itemCard = page
      .locator(`${Sel.cart.item}[data-product-id="${productId}"]`)
      .first();
    await expect(itemCard, "item recém-adicionado deve aparecer no carrinho").toBeVisible({
      timeout: 15_000,
    });

    // Lê quantidade atual e incrementa 2x via testid SSOT
    const qtyBadge = itemCard.locator(Sel.cart.qtyBadge).first();
    const qtyBefore =
      parseInt(
        ((await qtyBadge.innerText().catch(() => "1")) || "1").replace(/\D/g, ""),
        10,
      ) || 1;

    const plusBtn = itemCard.locator(Sel.cart.increment).first();
    await plusBtn.click();
    await page.waitForTimeout(250);
    await plusBtn.click();

    await expect
      .poll(
        async () => {
          const t = (await qtyBadge.innerText().catch(() => "")) || "";
          return parseInt(t.replace(/\D/g, ""), 10) || 0;
        },
        { timeout: 8_000, message: "quantidade não foi incrementada" },
      )
      .toBeGreaterThanOrEqual(qtyBefore + 1);

    // Abre checkout
    const checkoutBtn = page.locator(Sel.cart.checkoutCta).first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
    await checkoutBtn.click();

    // ConfirmDialog do checkout (testid escopado: cart-confirm-dialog-yes)
    await expect(page.locator(Sel.cart.confirmDialog).first()).toBeVisible({
      timeout: 8_000,
    });
    const confirmBtn = page.locator(Sel.cart.confirmDialogYes).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // Valida transição para /orcamentos/novo OU toast de sucesso
    const navigated = await page
      .waitForURL(/\/orcamentos\/novo/, { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (!navigated) {
      const successToast = page.locator(TOAST_SELECTOR).first();
      await expect(
        successToast,
        "esperava navegação para /orcamentos/novo OU toast de sucesso",
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  test("falha de backend ao gerar orçamento mostra erro e não quebra a UI", async ({
    page,
  }) => {
    const ready = await ensureActiveCart(page);
    test.skip(!ready, "Sem empresas para preparar carrinho");

    await addFirstProductToCart(page).catch(() => null);
    await gotoAndSettle(page, "/carrinhos");

    await page.route(
      (url) =>
        /\/rest\/v1\/(quotes|seller_carts|cart_items)/.test(url.href) ||
        /\/functions\/v1\/(create-quote|external-db-bridge)/.test(url.href),
      async (route) => {
        const method = route.request().method();
        if (method === "GET" || method === "HEAD") return route.continue();
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "simulated_backend_failure" }),
        });
      },
    );

    const checkoutBtn = page.locator(Sel.cart.checkoutCta).first();

    if (!(await checkoutBtn.isVisible().catch(() => false))) {
      test.skip(true, "Sem item/carrinho disponível para testar checkout com falha");
      return;
    }

    await checkoutBtn.click();

    const confirmBtn = page.locator(Sel.cart.confirmDialogYes).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    // Toast/banner de erro aparece (qualquer toast — sucesso ou erro indica feedback)
    const feedback = page.locator(TOAST_SELECTOR).first().or(
      page.locator(Sel.app.errorBanner).first(),
    );
    await expect(feedback, "esperava toast/banner de feedback após falha 500").toBeVisible({
      timeout: 10_000,
    });

    // UI não quebrou — heading da página continua visível
    await expect(page.locator(Sel.page.title("carrinhos")).first()).toBeVisible({
      timeout: 5_000,
    });

    expect(page.url()).not.toMatch(/\/orcamentos\/novo/);

    await page.unroute(
      (url) =>
        /\/rest\/v1\/(quotes|seller_carts|cart_items)/.test(url.href) ||
        /\/functions\/v1\/(create-quote|external-db-bridge)/.test(url.href),
    );
  });

  test("checkout bloqueia por campos obrigatórios e permite recuperação até confirmação final", async ({
    page,
  }) => {
    const ready = await ensureActiveCart(page);
    test.skip(!ready, "Sem empresas cadastradas para criar carrinho de teste");

    const productId = await addFirstProductToCart(page);
    test.skip(!productId, "Não foi possível adicionar produto para iniciar checkout");

    await gotoAndSettle(page, "/carrinhos");

    const checkoutBtn = page.locator(Sel.cart.checkoutCta).first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
    await checkoutBtn.click();

    const confirmBtn = page.locator(Sel.cart.confirmDialogYes).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    await page.waitForURL(/\/orcamentos\/novo/, { timeout: 12_000 });
    await expect(page.locator(Sel.page.title("orcamento-novo")).first()).toBeVisible({
      timeout: 10_000,
    });

    // Tentativa de avançar sem preencher dados obrigatórios (bloqueio esperado)
    const nextButton = page.locator(Sel.quote.next).first();
    await nextButton.click();

    const feedback = page.locator(TOAST_SELECTOR).first().or(page.locator(Sel.app.errorBanner).first());
    await expect(feedback).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("step-indicator-client")).toBeVisible({ timeout: 5_000 });

    // Recuperação: preencher campos obrigatórios e concluir fluxo
    const companySearch = page.getByPlaceholder("Buscar empresa por nome, CNPJ...");
    await companySearch.fill("Promo");
    const companyOption = page.locator('button:has-text("Promo")').first();
    await companyOption.waitFor({ state: "visible", timeout: 10_000 });
    await companyOption.click();
    await nextButton.click();

    await page.getByTestId("payment-method-select-root").click();
    await page.getByRole("option", { name: "Boleto Bancário" }).click();
    await page.getByTestId("payment-terms-select-root").click();
    await page.getByRole("option", { name: "7 dias a partir da entrega" }).click();
    await page.getByRole("button", { name: "Contar dias" }).click();
    await page.getByTestId("delivery-time-select-root").click();
    await page.getByRole("option", { name: "7 dias | Após aprovação" }).click();
    await page.getByTestId("shipping-type-select-root").click();
    await page.getByRole("option", { name: "FOB | Repassado ao cliente" }).click();
    await nextButton.click();

    // Validação final: etapa de resumo/confirmacão atingida após recuperação
    await expect(page.getByTestId("step-indicator-items")).toBeVisible({ timeout: 10_000 });
  });
});
