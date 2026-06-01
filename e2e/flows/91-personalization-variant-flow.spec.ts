import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Personalização via PDP (Segundo Produto)", () => {
  test.beforeEach(async () => {
    await requireAuth();
  });

  test("deve navegar de um produto diferente para o simulador com SKU correto", async ({ page }) => {
    // 1. Ir para a listagem de produtos
    await gotoAndSettle(page, "/produtos");
    
    // 2. Clicar no SEGUNDO produto para garantir que funciona com múltiplos casos
    const productCard = page.locator(Sel.product.card).nth(1);
    await expect(productCard).toBeVisible({ timeout: 15000 });
    
    const productName = await productCard.locator(Sel.product.cardName).innerText();
    
    // Clicar no link do produto
    await productCard.locator('a').first().click();
    
    // 3. Validar que estamos na PDP
    await expect(page).toHaveURL(/\/produtos\/.+/);
    await expect(page.locator(Sel.product.name)).toContainText(productName);
    
    // Pegar o SKU da PDP
    const productSku = (await page.locator(Sel.product.sku).innerText()).replace('SKU: ', '').trim();

    // 4. Clicar no badge de "Personalização"
    const personalizationBadge = page.locator(Sel.product.personalizationBadge);
    await expect(personalizationBadge).toBeVisible();
    await personalizationBadge.click();

    // 5. Validar simulador
    await expect(page).toHaveURL(/\/simulador/);
    await expect(page.locator(Sel.simulator.productName)).toContainText(productName);
    await expect(page.locator(Sel.simulator.productSku)).toContainText(productSku);
  });
});