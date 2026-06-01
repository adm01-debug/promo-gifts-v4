/**
 * Fluxo: Filtros UI — validação de filtros e reset.
 * Seletores: Sel.catalog.searchInput, Sel.page.title("produtos").
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Filtros UI", () => {
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

  test("aplica filtro de categoria via sidebar", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // O seletor para checkbox de categoria externa é [id^='ext-cat-']
    // Pode levar alguns segundos para carregar as categorias da API externa
    const categoryCheckbox = page.locator("[id^='ext-cat-']").first();
    await expect(categoryCheckbox).toBeVisible({ timeout: 15_000 });
    
    await categoryCheckbox.click();
    
    // Verifica se a URL contém o ID ou parâmetro de categoria
    await expect(page).toHaveURL(/categories=/);
  });

  test("limpa filtros via botão reset", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Aplicar um filtro via URL para garantir que o botão reset apareça
    await page.goto("/produtos?search=teste");
    
    // Espera o carregamento da página com o filtro
    await page.waitForURL(/search=teste/);
    
    // Clicar no botão Reset (aria-label definido em FilterPanelHeader)
    const resetButton = page.getByLabel("Resetar todos os filtros");
    await expect(resetButton).toBeVisible({ timeout: 10000 });
    await expect(resetButton).toBeEnabled();
    await resetButton.click();
    
    // Verifica se a URL voltou ao normal (sem search)
    await expect(page).not.toHaveURL(/search=teste/);
  });
});
