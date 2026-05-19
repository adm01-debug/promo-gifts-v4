import { test, expect } from "../fixtures/test-base";
import { Sel } from "../fixtures/selectors";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Login Error Diagnostics", () => {
  // Garantimos que não há sessão ativa
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, "/login");
  });

  test("deve exibir diagnóstico de credenciais inválidas para erro 400", async ({ page }) => {
    // Mock do erro 400 (Invalid credentials)
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await page.locator(Sel.login.email).fill("errado@promobrindes.com.br");
    await page.locator(Sel.login.password).fill("senha123");
    await page.locator(Sel.login.submit).click();

    // Verifica o título do toast
    await expect(page.getByText("Erro ao entrar")).toBeVisible();
    
    // Verifica a mensagem amigável
    await expect(page.getByText("Email ou senha incorretos")).toBeVisible();

    // Verifica o diagnóstico técnico
    await expect(page.getByText("DIAGNÓSTICO: AUTH_FAILED: Credenciais inválidas (400).")).toBeVisible();
  });

  test("deve exibir diagnóstico de rate limit para erro 429", async ({ page }) => {
    // Mock do erro 429 (Rate Limit)
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "over_request_rate_limit",
          error_description: "Email link quota exceeded",
        }),
      });
    });

    await page.locator(Sel.login.email).fill("bloqueado@promobrindes.com.br");
    await page.locator(Sel.login.password).fill("senha123");
    await page.locator(Sel.login.submit).click();

    await expect(page.getByText("Conta Temporariamente Bloqueada")).toBeVisible();
    await expect(page.getByText("Muitas tentativas falhas")).toBeVisible();
    await expect(page.getByText("DIAGNÓSTICO: RATE_LIMIT: Bloqueio temporário ativado (429).")).toBeVisible();
  });

  test("deve exibir diagnóstico de erro de rede quando a requisição falha", async ({ page }) => {
    // Mock de falha de rede
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      await route.abort("failed");
    });

    await page.locator(Sel.login.email).fill("offline@promobrindes.com.br");
    await page.locator(Sel.login.password).fill("senha123");
    await page.locator(Sel.login.submit).click();

    await expect(page.getByText("Erro de Conexão")).toBeVisible();
    await expect(page.getByText("Não foi possível alcançar o servidor")).toBeVisible();
    await expect(page.getByText("DIAGNÓSTICO: NETWORK_ERROR: Falha física ou DNS (0).")).toBeVisible();
  });

  test("deve exibir erro de sessão se o usuário for autenticado mas perfil falhar", async ({ page }) => {
    // 1. Mock de sucesso no token
    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fake_token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "fake_refresh",
          user: { id: "fake_user_id", email: "perfil_erro@promobrindes.com.br" }
        }),
      });
    });

    // 2. Mock de falha na busca do perfil (RLS ou erro de banco)
    await page.route("**/rest/v1/profiles?select=is_active%2Crole&user_id=eq.fake_user_id", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST301",
          message: "Row level security policy violation"
        }),
      });
    });

    await page.locator(Sel.login.email).fill("perfil_erro@promobrindes.com.br");
    await page.locator(Sel.login.password).fill("senha123");
    await page.locator(Sel.login.submit).click();

    // No Auth.tsx, o erro de perfil gera um toast de "Erro de Sessão"
    await expect(page.getByText("Erro de Sessão")).toBeVisible();
    await expect(page.getByText("Autenticado, mas não conseguimos carregar suas permissões.")).toBeVisible();
    await expect(page.getByText("RLS_BLOCK: PGRST301 - Row level security policy violation")).toBeVisible();
  });
});
