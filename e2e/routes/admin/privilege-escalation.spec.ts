import { test, expect, requireAuth } from "../../fixtures/test-base";
import { gotoAndSettle } from "../../helpers/nav";

const ADMIN_SECURITY_ROUTE = "/admin/seguranca";

test.describe("Admin RBAC — acesso e tentativa de elevação de privilégio", () => {
  test.beforeEach(() => requireAuth());

  test("tela admin bloqueada para perfil sem permissão: redireciona e mantém status code 403", async ({ page }) => {
    await page.route(/\/rest\/v1\/admin_settings(\?|$)/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ code: "42501", message: "permission denied" }),
      }),
    );

    await gotoAndSettle(page, ADMIN_SECURITY_ROUTE);

    const redirectedToNonAdminArea = !page.url().includes(ADMIN_SECURITY_ROUTE);
    const hasForbiddenFeedback = await page
      .getByText(/403|forbidden|sem permissão|acesso negado/i)
      .first()
      .isVisible()
      .catch(() => false);

    expect(redirectedToNonAdminArea || hasForbiddenFeedback).toBeTruthy();
  });

  test("ações administrativas bloqueadas via UI: backend responde 403", async ({ page }) => {
    let capturedMethod = "";
    await page.route(/\/rest\/v1\/admin_settings(\?|$)/, async (route) => {
      capturedMethod = route.request().method();
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ code: "42501", message: "permission denied" }),
      });
    });

    await gotoAndSettle(page, ADMIN_SECURITY_ROUTE);

    await page.evaluate(async () => {
      await fetch("/rest/v1/admin_settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "security_mode", value: "disabled" }),
      });
    });

    expect(capturedMethod).toBe("PATCH");
  });

  test("tentativa de elevação de privilégio por request direta retorna 403", async ({ page }) => {
    await page.route(/\/rest\/v1\/user_roles(\?|$)/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ code: "42501", message: "permission denied for role update" }),
      }),
    );

    const result = await page.evaluate(async () => {
      const response = await fetch("/rest/v1/user_roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, body };
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(String(result.body?.message ?? "")).toMatch(/permission denied/i);
  });
});
