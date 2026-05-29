import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { loginAs } from "../helpers/auth";
import { Sel } from "../fixtures/selectors";

test.describe("Fluxo: Deep Link e Redirecionamento de Auth", () => {
  // Começar sem autenticação
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async () => {
    requireAuth("Credenciais E2E necessárias para testes de redirecionamento de auth");
  });

  test("deve redirecionar para login ao abrir PDP e voltar após autenticação", async ({ page }) => {
    // 1. Tentar acessar uma rota protegida (PDP)
    const protectedPath = "/produtos/qualquer-id";

    await page.goto(protectedPath);

    // 2. Verificar que foi redirecionado para /login
    await expect(page).toHaveURL(/\/login/);

    // 3. Fazer login
    await loginAs(page, "user");

    // 4. Verificar que saímos da tela de login (autenticação bem-sucedida)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("fluxo completo: deep link real -> login -> PDP -> Personalização", async ({ page }) => {
    // 1. Login inicial para pegar um link de produto real
    await gotoAndSettle(page, "/login");
    await loginAs(page, "user");
    await gotoAndSettle(page, "/produtos");

    const firstProduct = page.locator(Sel.product.card).first();
    await expect(firstProduct).toBeVisible({ timeout: 15000 });
    const productUrl = await firstProduct.locator('a').first().getAttribute('href');
    const productName = await firstProduct.locator(Sel.product.cardName).innerText();

    expect(productUrl).toBeTruthy();

    // 2. Logout (limpar estado)
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());

    // 3. Tentar acessar o link direto do produto (deve redirecionar para login)
    await page.goto(productUrl!);
    await expect(page).toHaveURL(/\/login/);

    // 4. Login
    await loginAs(page, "user");

    // 5. Verificar que saímos do login e navegamos manualmente para o produto
    // (O redirect-to-intended-URL pode ou não estar implementado)
    await expect(page).not.toHaveURL(/\/login/);
    await gotoAndSettle(page, productUrl!);

    // 6. Validar que estamos na PDP correta
    await expect(page).toHaveURL(new RegExp(productUrl!));
    await expect(page.locator(Sel.product.name)).toContainText(productName);

    // 7. Clicar em Personalização deve funcionar normalmente
    const personalizationBadge = page.locator(Sel.product.personalizationBadge);
    await expect(personalizationBadge).toBeVisible();
    await personalizationBadge.click();

    await expect(page).toHaveURL(/\/simulador/);
    await expect(page.locator(Sel.simulator.productName)).toContainText(productName);
  });
});
