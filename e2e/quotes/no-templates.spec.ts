/**
 * Garante que a funcionalidade de "Templates de Orçamento" foi removida:
 * - rota /orcamentos/templates redireciona para /orcamentos
 * - nenhum link/botão de menu, sidebar ou catálogo aponta para a rota legada
 * - nenhum botão Usar/Salvar Template aparece no wizard
 * - navegação para páginas existentes continua funcionando
 */
import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Quotes — templates removidos", () => {
  test("/orcamentos não exibe botão de Templates", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.getByRole("button", { name: /^templates$/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^templates$/i })).toHaveCount(0);
  });

  test("/orcamentos/novo não exibe Usar/Salvar Template", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await expect(page.getByRole("button", { name: /usar template/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /salvar como template/i })).toHaveCount(0);
  });

  test("/orcamentos/templates redireciona para /orcamentos", async ({ page }) => {
    await page.goto("/orcamentos/templates");
    await expect(page).toHaveURL(/\/orcamentos(\?|$|\/?$)/);
    await expect(page).not.toHaveURL(/\/orcamentos\/templates/);
  });

  test("nenhum href= aponta para /orcamentos/templates", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    const hrefs = await page.locator('a[href*="/orcamentos/templates"]').count();
    expect(hrefs).toBe(0);

    await gotoAndSettle(page, "/orcamentos/novo");
    const hrefs2 = await page.locator('a[href*="/orcamentos/templates"]').count();
    expect(hrefs2).toBe(0);
  });

  test("navegação para páginas existentes continua funcionando", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page).toHaveURL(/\/orcamentos(\/|$)/);

    await gotoAndSettle(page, "/orcamentos/kanban");
    await expect(page).toHaveURL(/\/orcamentos\/kanban/);

    await gotoAndSettle(page, "/orcamentos/dashboard");
    await expect(page).toHaveURL(/\/orcamentos\/dashboard/);

    await gotoAndSettle(page, "/orcamentos/novo");
    await expect(page).toHaveURL(/\/orcamentos\/novo/);
  });
});
