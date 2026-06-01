/**
 * E2E: validação básica do formulário de login (sem credenciais reais).
 *
 * Usa exclusivamente helpers SSOT: `gotoAndSettle`, `loginViaUI`,
 * `expectVisibleByTestId` — proibido `page.goto`/`waitForTimeout` direto.
 */
import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginViaUI, expectUnauthenticated } from "./helpers/auth";
import { expectVisibleByTestId } from "./helpers/waits";

test.describe("Login Page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("exibe formulário de login", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    await expectVisibleByTestId(page, "login-email-input");
    await expectVisibleByTestId(page, "login-password-input");
    await expectVisibleByTestId(page, "login-submit");
    
    // Garante que o card de status da infraestrutura NÃO está presente (Desktop)
    await expect(page.locator('text=Status da Infraestrutura')).not.toBeVisible();
    await expect(page.locator('text=Banco de Dados')).not.toBeVisible();
    await expect(page.locator('[data-testid="infrastructure-status-card"]')).not.toBeAttached();
  });

  test("não exibe card de status em mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, "/login");
    
    // Garante que o card de status da infraestrutura NÃO está presente (Mobile)
    await expect(page.locator('text=Status da Infraestrutura')).not.toBeVisible();
    await expect(page.locator('[data-testid="infrastructure-status-card"]')).not.toBeAttached();
  });

  test("submit vazio mantém usuário em /login", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    await page.locator('[data-testid="login-submit"]').click();
    await expectUnauthenticated(page);
  });

  test("credenciais inválidas mantêm usuário em /login", async ({ page }) => {
    await loginViaUI(page, {
      email: "invalid@test.com",
      password: "wrongpassword123",
      expectFail: true,
    });
    await expectUnauthenticated(page);
    expect(page.url()).toMatch(/\/login/);
  });

  test("exibe link de recuperação de senha", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    // UI real em src/pages/Auth.tsx:398-406:
    //   <Button data-testid="login-forgot-link" variant="link-primary">Esqueci minha senha</Button>
    // Antes procurava `a:text("Esqueceu a senha")` — anchor + texto que NÃO EXISTEM.
    // Selector por data-testid é mais robusto (não quebra se trocarem o texto).
    await expectVisibleByTestId(page, "login-forgot-link");
    await expect(page.locator('[data-testid="login-forgot-link"]')).toHaveText(/Esqueci minha senha/i);
  });

  test("valida formato de email no client-side", async ({ page }) => {
    await gotoAndSettle(page, "/login");
    await page.locator('[data-testid="login-email-input"]').fill("invalid-email");
    await page.locator('[data-testid="login-submit"]').click();
    // HTML5 validation or custom error message
    const emailInput = page.locator('[data-testid="login-email-input"]');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity() || el.classList.contains('invalid'));
    expect(isInvalid).toBeTruthy();
  });
});
