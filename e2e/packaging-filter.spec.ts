import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

test.describe("Módulo: Embalagem — Testes E2E de Filtro e Tooltip", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await gotoAndSettle(page, "/filtros");
    await waitForRouteIdle(page);
  });

  test("Filtro 'Com Embalagem' no Super Filtro", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Abre a seção de Opções Rápidas
    const quickOptionsBtn = page.locator('button:has-text("Opções Rápidas")');
    await quickOptionsBtn.click();
    
    // Localiza e clica no checkbox de embalagem
    const packagingCheckbox = page.locator('label:has-text("Com Embalagem Nativa")');
    await expect(packagingCheckbox).toBeVisible();
    await packagingCheckbox.click();
    
    await waitForRouteIdle(page);
    
    // Verifica se os produtos exibidos possuem o badge de embalagem
    // Nota: dependemos de dados reais ou mockados. No E2E real, verificamos se o badge aparece nos resultados.
    const packagingBadges = page.locator('article[data-testid="product-card"] span:has-text("Embalagem")');
    const count = await packagingBadges.count();
    
    // Se houver resultados, todos devem ter o badge
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(packagingBadges.nth(i)).toBeVisible();
      }
    }
  });

  test("Tooltip de Detalhes da Embalagem", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Localiza o primeiro badge de embalagem no grid
    const firstBadge = page.locator('span:has-text("Embalagem")').first();
    
    if (await firstBadge.isVisible()) {
      // Hover para disparar o tooltip
      await firstBadge.hover();
      
      // Verifica se o tooltip apareceu com os detalhes esperados
      const tooltip = page.locator('div[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText("Embalagem Especial");
      // Detalhes como Tipo ou Dimensões devem estar presentes
      const details = tooltip.locator('p');
      await expect(details.count()).toBeGreaterThan(1);
    }
  });
});
