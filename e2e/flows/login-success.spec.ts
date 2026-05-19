import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { loginAs, expectAuthenticated } from "../helpers/auth";
import { expectVisibleByTestId } from "../helpers/waits";

test.describe("Fluxo: Login e Redirecionamento", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("deve realizar login com sucesso e navegar para a dashboard", async ({ page }) => {
    // 1. Vai para a tela de login
    await gotoAndSettle(page, "/login");
    
    // 2. Realiza o login (usa helper que preenche e clica)
    await loginAs(page, "user");
    
    // 3. Verifica se está autenticado (sessão ativa)
    await expectAuthenticated(page);
    
    // 4. Verifica se o título da página de dashboard está visível
    // O slug da dashboard no PageSlug é 'dashboard'
    await expectVisibleByTestId(page, "page-title-dashboard", { timeout: 10000 });
    
    // 5. Verifica se a URL não contém mais /login
    expect(page.url()).not.toContain("/login");
  });
});
