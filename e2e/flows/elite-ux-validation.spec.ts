import { test, expect } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle } from "../helpers/nav";
import { expectVisibleByTestId } from "../helpers/waits";

async function gotoCatalog(page: Parameters<typeof gotoAndSettle>[0]) {
  await gotoAndSettle(page, "/produtos");
  await expectVisibleByTestId(page, "page-title-produtos");
}

async function visibleProductCards(page: Parameters<typeof gotoAndSettle>[0]) {
  const cards = page.locator(Sel.product.card);
  const emptyState = page
    .locator('[data-testid="empty-catalog-state"]')
    .or(page.getByText("Nenhum produto encontrado"))
    .first();

  await expect(cards.first().or(emptyState)).toBeVisible({ timeout: 15_000 });

  const count = await cards.count();
  test.skip(count === 0, "Catalogo sem cards renderizados para validar fluxo visual.");
  return cards;
}

test.describe("Elite UX & Resilience Validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("keeps catalog search resilient for plain and diacritic queries", async ({ page }) => {
    await gotoCatalog(page);

    const searchInput = page.locator(Sel.catalog.searchInput).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Caneca");
    await searchInput.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"), { timeout: 10_000 })
      .toBe("Caneca");
    await expectVisibleByTestId(page, "page-title-produtos");

    const diacriticQuery = "can\u00eca";
    await searchInput.fill(diacriticQuery);
    await searchInput.press("Enter");
    await expect
      .poll(() => new URL(page.url()).searchParams.get("search"), { timeout: 10_000 })
      .toBe(diacriticQuery);
    await expect(page.locator(Sel.product.card).first().or(page.getByText("Nenhum produto encontrado").first()))
      .toBeVisible({ timeout: 15_000 });
  });

  test("keeps quote builder validation stable on the client step", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");

    await expectVisibleByTestId(page, "page-title-orcamento-novo");
    await expectVisibleByTestId(page, "quote-wizard");

    await page.locator(Sel.quote.next).click();

    const validationFeedback = page
      .getByText(/Selecione um cliente/i)
      .or(page.locator(Sel.ext.sonnerToast).filter({ hasText: /Selecione um cliente/i }))
      .first();
    await expect(validationFeedback).toBeVisible({ timeout: 10_000 });
    await expectVisibleByTestId(page, "page-title-orcamento-novo");
  });

  test("renders the catalog shell when the external bridge fails", async ({ page }) => {
    await page.route("**/functions/v1/external-db-bridge", (route) => route.abort("failed"));

    await gotoCatalog(page);

    await expect(page.locator(Sel.app.notFound)).toHaveCount(0);
    await expect(page.locator(Sel.catalog.searchInput).first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows bulk actions after selecting products in the catalog", async ({ page }) => {
    await gotoCatalog(page);
    const cards = await visibleProductCards(page);

    const count = await cards.count();
    test.skip(count < 2, "Catalogo precisa de ao menos 2 cards para validar a barra em massa.");

    await page.getByRole("button", { name: /Ativar modo de sele/i }).click();
    await cards.nth(0).click();
    await cards.nth(1).click();

    await expect(page.getByText("selecionados", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar sele/i })).toBeVisible();
  });
});
