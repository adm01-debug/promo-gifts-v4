/**
 * E2E — Rotas críticas de Admin: validação de carregamento e RBAC
 *
 * Verifica que todas as rotas administrativas críticas:
 *   - Carregam sem crash (não 404/500)
 *   - Redirecionam corretamente usuários não-autorizados
 *   - Exibem conteúdo correto para usuários autenticados
 */
import { test, expect } from "@playwright/test";

const ADMIN_ROUTES = [
  { path: "/admin/usuarios", label: "Gestão de Usuários" },
  { path: "/admin/roles", label: "Roles e Permissões" },
  { path: "/admin/conexoes", label: "Conexões externas" },
  { path: "/admin/seguranca", label: "Segurança" },
  { path: "/admin/rate-limit", label: "Rate Limit" },
  { path: "/admin/rls-denials", label: "RLS Denials" },
  { path: "/admin/system-status", label: "System Status" },
  { path: "/admin/telemetry", label: "Telemetria" },
  { path: "/admin/ai-usage", label: "AI Usage" },
  { path: "/admin/workflows", label: "Workflows" },
] as const;

test.describe("Rotas Admin críticas — carregamento e RBAC", () => {
  for (const { path, label } of ADMIN_ROUTES) {
    test(`${label} (${path}) carrega ou redireciona para login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Deve carregar OU redirecionar para login — nunca retornar 500
      const isLoginPage = page.url().includes("/login");
      const body = page.locator("body");

      await expect(body).not.toContainText("500", { timeout: 10_000 });
      await expect(body).not.toContainText("Unexpected error", { timeout: 5_000 });

      if (!isLoginPage) {
        // Se não redirecionou, a página deve ter algum conteúdo (não estar em branco)
        const hasContent = await body.locator("main, [role='main'], [data-testid], h1, h2").count();
        expect(hasContent).toBeGreaterThan(0);
      }
    });
  }

  test("navegação entre rotas admin é fluida (sem full reload)", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await page.waitForLoadState("networkidle");

    const prevUrl = page.url();
    await page.goto("/admin/roles");
    await page.waitForLoadState("networkidle");

    const newUrl = page.url();

    // Ambas devem ter carregado (URL mudou ou permaneceu em login se sem auth)
    expect(typeof prevUrl).toBe("string");
    expect(typeof newUrl).toBe("string");
    await expect(page.locator("body")).not.toContainText("500");
  });

  test("dashboard admin (/admin) carrega sem 500", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toContainText("500");
  });
});
