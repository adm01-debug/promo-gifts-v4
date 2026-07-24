/**
 * Fluxo: Filtros UI — validação de filtros e reset.
 * Seletores: Sel.catalog.searchInput, Sel.page.title("produtos").
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Filtros UI e Persistência", () => {
  test.beforeEach(() => requireAuth());

  test("navega para filtros e aplica busca por texto", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const searchInput = page.locator(Sel.catalog.searchInput).first();
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill("caneta");
    await page.keyboard.press("Enter");
    
    // Verifica se a URL mudou para incluir o parâmetro de busca
    await expect(page).toHaveURL(/search=caneta/);
    
    // Verifica se o título da página aparece
    await expect(page.locator(Sel.page.title("produtos"))).toBeVisible();
  });

  test("persiste busca após refresh e navegação back/forward", async ({ page }) => {
    await gotoAndSettle(page, "/produtos?search=caneta");
    await expect(page.locator(Sel.catalog.searchInput)).toHaveValue("caneta");

    // Refresh
    await page.reload();
    await settleAfterAction(page);
    await expect(page).toHaveURL(/search=caneta/);
    await expect(page.locator(Sel.catalog.searchInput)).toHaveValue("caneta");

    // Navega para detalhe e volta
    const firstCard = page.locator(Sel.catalog.card).first();
    await firstCard.click();
    await settleAfterAction(page);
    await expect(page).not.toHaveURL(/\/produtos/);

    await page.goBack();
    await settleAfterAction(page);
    await expect(page).toHaveURL(/search=caneta/);
    await expect(page.locator(Sel.catalog.searchInput)).toHaveValue("caneta");
  });

  test("aplica filtro de categoria via sidebar", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    const categoryCheckbox = page.locator("[id^='ext-cat-']").first();
    await expect(categoryCheckbox).toBeVisible({ timeout: 15_000 });
    
    await categoryCheckbox.click();
    await expect(page).toHaveURL(/categories=/);
  });

  test("limpa filtros via botão reset", async ({ page }) => {
    await gotoAndSettle(page, "/produtos?search=teste");
    
    const resetButton = page.getByLabel("Resetar todos os filtros");
    await expect(resetButton).toBeVisible({ timeout: 10000 });
    await resetButton.click();
    
    await expect(page).not.toHaveURL(/search=teste/);
  });
});
