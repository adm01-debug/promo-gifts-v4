/**
 * Garante que a funcionalidade de "Templates de Orçamento" foi removida:
 * - rota /orcamentos/templates não existe mais (404/redirect)
 * - nenhum botão/UI de template aparece no wizard nem na listagem
 * - navegação para páginas existentes continua funcionando
 */
import { test, expect } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

const TEMPLATE_TEXT = /usar template|salvar como template|templates de orçamento|aplicar template/i;

test.describe("Quotes — templates removidos", () => {
  test("/orcamentos não exibe botão de Templates nem ação de template", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("button", { name: /^templates$/i })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(TEMPLATE_TEXT);
  });

  test("/orcamentos/novo não exibe Usar/Salvar Template", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos/novo");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("button", { name: /usar template/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /salvar como template/i })).toHaveCount(0);
  });

  test("/orcamentos/templates não está mais registrada", async ({ page }) => {
    await page.goto("/orcamentos/templates");
    // SPA fallback serve o index — então valida que NÃO renderizou uma página de templates.
    await expect(page.locator("body")).not.toContainText(/templates de orçamento/i);
  });

  test("navegação para páginas existentes continua funcionando", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    await expect(page).toHaveURL(/\/orcamentos(\/|$)/);

    await gotoAndSettle(page, "/orcamentos/kanban");
    await expect(page).toHaveURL(/\/orcamentos\/kanban/);

    await gotoAndSettle(page, "/orcamentos/dashboard");
    await expect(page).toHaveURL(/\/orcamentos\/dashboard/);
  });
});
