import { test, expect } from "./fixtures/test-base";
import { Sel } from "./fixtures/selectors";
import { gotoAndSettle } from "./helpers/nav";
import { loginViaUI, expectAuthenticated } from "./helpers/auth";

/**
 * Smoke Test: Fluxo Crítico de Autenticação @smoke
 * 
 * Este teste valida os pilares do sistema no projeto canônico:
 * 1. Login com credenciais válidas (adm01)
 * 2. Redirecionamento para Dashboard
 * 3. Bloqueio de rotas protegidas sem sessão
 * 4. Recuperação de senha (abertura do formulário)
 */

test.describe("Auth Critical Flow @smoke", () => {
  // Limpa estado para garantir teste limpo
  test.use({ storageState: { cookies: [], origins: [] } });

  test("deve realizar login com sucesso e redirecionar para a home", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_USER_PASSWORD;

    if (!email || !password) {
      test.skip(true, "E2E_ADMIN_EMAIL/PASSWORD ou E2E_USER_EMAIL/PASSWORD não configurados — smoke login pulado em CI sem credenciais");
      return;
    }

    console.log(`[Smoke] Iniciando login para ${email}`);
    
    // loginViaUI já faz o assert de não estar mais em /login se tiver sucesso
    const success = await loginViaUI(page, { email: email!, password: password! });
    expect(success).toBe(true);
    
    // Valida que estamos na home ou dashboard
    await expectAuthenticated(page);
    
    // Verifica se o Header do app carregou (sinal de que a sessão foi hidratada no context)
    // O seletor app-header é usado no componente Header.tsx
    await expect(page.locator(Sel.app.header)).toBeVisible();
    
    console.log(`[Smoke] Login OK. URL atual: ${page.url()}`);
  });

  test("deve bloquear acesso a rotas protegidas quando deslogado", async ({ page }) => {
    // Tenta acessar /produtos diretamente
    console.log("[Smoke] Testando bloqueio de rota protegida");
    // Em AppRoutes.tsx, as rotas protegidas estão sob <ProtectedRoute />
    // /produtos (productRoutes) é protegida.
    await gotoAndSettle(page, "/produtos");
    
    // Deve redirecionar para /auth ou /login
    await expect(page, "deveria redirecionar para /auth ou /login").toHaveURL(
      /\/(auth|login)(\/|\?|#|$)/,
      { timeout: 5_000 },
    );
    expect(page.url()).toMatch(/\/(auth|login)/);
  });

  test("deve exibir formulário de esqueci minha senha", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    
    // Clica no link de esqueci minha senha
    await page.locator(Sel.login.forgot).click();
    
    // Verifica se a tela de recuperação apareceu
    await expect(page.locator(Sel.login.forgotScreen)).toBeVisible();
    await expect(page.locator('text=Esqueceu sua senha?')).toBeVisible();
  });
});
