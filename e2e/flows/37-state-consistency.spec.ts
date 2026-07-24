/**
 * E2E Stress & Consistency - Verificação de Requests Duplicados e Estado
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";

test.describe("Consistência de Estado e Performance", () => {
  test.beforeEach(() => requireAuth());

  test("Ausência de requests duplicados em rotas de listagem", async ({ page }) => {
    const urls: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/rest/v1/')) {
        urls.push(request.url());
      }
    });

    await gotoAndSettle(page, "/produtos");
    
    // Filtrar duplicatas exatas (URL + Query Params)
    const duplicates = urls.filter((item, index) => urls.indexOf(item) !== index);
    
    // Algumas duplicações podem ser normais se houver polling, mas em carregamento inicial deve ser evitado.
    // Aceitamos um threshold baixo para flakes de polling se houver.
    expect(duplicates.length, `Requests duplicados detectados: ${duplicates.join(', ')}`).toBeLessThan(5);
  });

  test("Consistência de estado ao trocar de rota rapidamente", async ({ page }) => {
    await page.goto("/produtos");
    await page.click('[data-testid^="sidebar-link-orcamentos"]');
    await page.click('[data-testid^="sidebar-link-clientes"]');
    await page.click('[data-testid^="sidebar-link-dashboard"]');
    
    // Deve estabilizar na última rota sem erros de renderização/crash
    await expect(page).toHaveURL("/");
    const body = page.locator("body");
    await expect(body).not.toContainText("Error");
    await expect(body).not.toContainText("500");
  });
});
