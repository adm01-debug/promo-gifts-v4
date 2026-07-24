/**
 * E2E — Error Boundaries e rotas inexistentes
 *
 * Valida que a aplicação trata corretamente:
 *   - Rotas que não existem (404)
 *   - Deep links com parâmetros inválidos
 *   - Navegação para sub-rotas inexistentes
 *   - Não exibe stack traces em produção
 */
import { test, expect } from "@playwright/test";

test.describe("Error Boundaries e tratamento de erros", () => {
  test("rota inexistente exibe página 404 amigável (não stack trace)", async ({ page }) => {
    await page.goto("/rota-que-nao-existe-12345");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    // Não deve exibir stack trace bruto
    await expect(body).not.toContainText("at Object.<anonymous>", { timeout: 5_000 });
    await expect(body).not.toContainText("TypeError:", { timeout: 5_000 });
    await expect(body).not.toContainText("ReferenceError:", { timeout: 5_000 });
    // Deve exibir alguma mensagem amigável (404 ou "não encontrada")
    const hasErrorContent = await body
      .locator("text=/404|não encontr|not found|page.*not.*found/i")
      .count()
      .catch(() => 0);
    // Aceita também se redirecionar para home/dashboard
    const isRedirected = page.url().endsWith("/") || page.url().includes("/dashboard") || page.url().includes("/login");
    expect(hasErrorContent > 0 || isRedirected).toBe(true);
  });

  test("URL com parâmetro de produto inválido não crashar em 500", async ({ page }) => {
    await page.goto("/produtos/produto-id-invalido-xyz-nao-existe");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).not.toContainText("500");
    await expect(body).not.toContainText("Internal Server Error");
    await expect(body).not.toContainText("TypeError:");
  });

  test("URL com ID de orçamento inválido não expõe stack trace", async ({ page }) => {
    await page.goto("/orcamentos/00000000-0000-0000-0000-000000000000");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).not.toContainText("at Object.<anonymous>", { timeout: 5_000 });
    await expect(body).not.toContainText("Unhandled Runtime Error", { timeout: 5_000 });
  });

  test("query params com XSS não são renderizados sem escape", async ({ page }) => {
    await page.goto("/produtos?q=<script>alert(1)</script>");
    await page.waitForLoadState("networkidle");

    // O script não deve ter executado — verificamos pelo título da página
    const title = await page.title();
    expect(title).not.toContain("<script>");

    // A tag <script> não deve aparecer como texto visível na página
    const body = page.locator("body");
    const bodyText = await body.innerText().catch(() => "");
    expect(bodyText).not.toContain("<script>alert(1)</script>");
  });

  test("rota de admin inexistente não expõe informações sensíveis", async ({ page }) => {
    await page.goto("/admin/rota-inexistente-segura");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    await expect(body).not.toContainText("SUPABASE_SERVICE_ROLE", { timeout: 5_000 });
    await expect(body).not.toContainText("postgresql://", { timeout: 5_000 });
    await expect(body).not.toContainText("secret", { timeout: 5_000 });
  });

  test("aplicação mantém header sticky em página de erro", async ({ page }) => {
    await page.goto("/pagina-que-nao-existe");
    await page.waitForLoadState("networkidle");

    const header = page.locator("header, [data-testid='app-header']").first();
    const isVisible = await header.isVisible().catch(() => false);
    // Header pode não existir em página de erro simples — só valida se presente
    if (isVisible) {
      const position = await header.evaluate((el) => getComputedStyle(el).position);
      expect(["sticky", "fixed"]).toContain(position);
    }
  });

  test("navegação de volta funciona após 404", async ({ page }) => {
    await page.goto("/produtos");
    await page.waitForLoadState("networkidle");

    await page.goto("/rota-inexistente-xyz");
    await page.waitForLoadState("networkidle");

    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Deve voltar para /produtos ou estar em página válida
    await expect(page.locator("body")).not.toContainText("500");
  });
});
