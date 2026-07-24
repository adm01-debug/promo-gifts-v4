import { test, expect } from "../../fixtures/test-base";
import { Sel } from "../../fixtures/selectors";
import {
  loginViaUI,
  logout,
  expectAuthenticated,
  expectUnauthenticated,
} from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

const E2E_USER = process.env.E2E_USER_EMAIL;
const E2E_PASS = process.env.E2E_USER_PASSWORD;

test.describe("P0 — Auth E2E (login/logout/sessão/expiração)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login válido mantém sessão ativa; logout invalida sessão e redireciona para /login", async ({ page }) => {
    test.skip(!E2E_USER || !E2E_PASS, "Credenciais E2E_USER_* ausentes");

    await loginViaUI(page, { email: E2E_USER!, password: E2E_PASS! });
    await expectAuthenticated(page);

    await page.goto("/produtos");
    await expect(page).toHaveURL(/\/produtos/);

    await logout(page);
    await expectUnauthenticated(page);

    await page.goto("/produtos").catch(() => {});
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("sessão inativa: acesso direto à rota protegida deve redirecionar para /login", async ({ page }) => {
    await page.goto("/produtos");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("credenciais inválidas exibem mensagem de erro padrão", async ({ page }) => {
    await gotoAndSettle(page, "/login");

    await page.route("**/auth/v1/token?grant_type=password", async route => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        }),
      });
    });

    await page.locator(Sel.login.email).first().fill("invalido@promobrindes.com.br");
    await page.locator(Sel.login.password).first().fill("SenhaInvalida@2026!");
    await page.locator(Sel.login.submit).first().click();

    await expect(page.getByText("Erro ao entrar")).toBeVisible();
    await expect(page.getByText("Email ou senha incorretos")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("expiração de token/sessão: refresh 401 derruba sessão e exige novo login", async ({ page }) => {
    test.skip(!E2E_USER || !E2E_PASS, "Credenciais E2E_USER_* ausentes");

    await loginViaUI(page, { email: E2E_USER!, password: E2E_PASS! });
    await expectAuthenticated(page);

    await page.route(/\/auth\/v1\/(token|user)/, async route => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "invalid_grant",
          error_description: "JWT expired",
        }),
      });
    });

    await page.reload();
    await page.goto("/dashboard").catch(() => {});

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByText(/sessão|session|expirad/i)).toBeVisible({ timeout: 5_000 }).catch(() => {});
  });
});
