import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Personalização via PDP", () => {
  test.beforeEach(async () => {
    await requireAuth();
  });

  test("deve navegar da PDP para o simulador com produto carregado", async ({ page }) => {
    // 1. Ir para a listagem de produtos
    await gotoAndSettle(page, "/produtos");
    
    // 2. Clicar no primeiro produto para abrir a PDP
    const productCard = page.locator(Sel.product.card).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
    
    // Pegar o nome do produto para validar depois
    const productName = await productCard.locator(Sel.product.cardName).innerText();
    
    // Clicar no link do produto (âncora dentro do card)
    await productCard.locator('a').first().click();
    
    // 3. Validar que estamos na PDP
    await expect(page).toHaveURL(/\/produtos\/.+/);
    await expect(page.locator(Sel.product.name)).toContainText(productName);
    
    // Pegar o SKU da PDP para comparar depois
    const productSku = (await page.locator(Sel.product.sku).innerText()).replace('SKU: ', '').trim();

    // 4. Localizar e clicar no badge de "Personalização"
    const personalizationBadge = page.locator(Sel.product.personalizationBadge);
    await expect(personalizationBadge).toBeVisible();
    await personalizationBadge.click();

    // 5. Validar navegação para o simulador
    await expect(page).toHaveURL(/\/simulador/);
    await expect(page.locator(Sel.simulator.title)).toBeVisible();

    // 6. Validar que o produto correto foi carregado no simulador
    // O simulador deve mostrar o nome do produto na barra de contexto
    await expect(page.locator(Sel.simulator.productName)).toContainText(productName);
    await expect(page.locator(Sel.simulator.productSku)).toContainText(productSku);
    
    // Validar que o primeiro passo (Produto) foi pulado ou está marcado como concluído
    // (Dependendo da implementação do wizard, ele pode ir direto para o passo de Local)
    // Mas o mais importante é que o produto está selecionado.
  });
});
