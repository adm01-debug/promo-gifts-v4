/**
 * E2E CRUD - Clientes
 * Valida criação e edição de clientes através de fluxos de venda/CRM.
 * Nota: Edição direta de clientes CRM costuma ser restrita ou via modais.
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, settleAfterAction } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Clientes", () => {
  test.beforeEach(() => requireAuth());

  test("Busca e Paginação de Clientes", async ({ page }) => {
    await gotoAndSettle(page, "/clientes");
    await expect(page.locator(Sel.page.title("clientes"))).toBeVisible();

    // Buscar por termo conhecido (ex: "Promobrind" ou similar se houver seed)
    const searchInput = page.locator('input[placeholder*="Buscar por nome"]');
    await searchInput.fill("a"); // busca genérica
    await page.keyboard.press("Enter");
    await settleAfterAction(page);

    const cards = page.locator('[role="button"]'); // ClientCards
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    
    // Testar navegação para detalhe
    await cards.first().click();
    await expect(page).toHaveURL(/\/clientes\//);
    await expect(page.locator(Sel.page.title("clientes-detalhe"))).toBeVisible();
  });

  test("Estado e Consistência ao navegar entre clientes", async ({ page }) => {
    await gotoAndSettle(page, "/clientes");
    
    const cards = page.locator('[role="button"]');
    await cards.nth(0).click();
    const url1 = page.url();
    
    await page.goBack();
    await settleAfterAction(page);
    
    await cards.nth(1).click();
    const url2 = page.url();
    
    expect(url1).not.toEqual(url2);
    await expect(page.locator(Sel.page.title("clientes-detalhe"))).toBeVisible();
  });
});
