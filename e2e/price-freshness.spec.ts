import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

test.describe("Price Freshness Badge - PDP", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    // Navegar para a página de produtos e selecionar o primeiro
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await waitForRouteIdle(page);
  });

  test("Badge no PDP mostra apenas o essencial e tooltip mostra detalhes completos", async ({ page }) => {
    // Localiza o badge de atualização de preço (usando role status conforme definido no componente)
    const badge = page.locator('[role="status"]').filter({ hasText: /Atualizado em|Data não informada|Preço pode estar defasado/ }).first();
    await expect(badge).toBeVisible();

    const badgeText = await badge.innerText();
    
    // Verifica se o texto do badge segue o padrão "Atualizado em DD/MM/AAAA" (ou "Data não informada")
    // Note: No PDP usamos variant="pdp" que foi simplificado.
    if (badgeText.includes("Atualizado em")) {
      expect(badgeText).toMatch(/^Atualizado em \d{2}\/\d{2}\/\d{4}$/);
      // Garante que NÃO contém o texto relativo ("há X dias") no badge visível
      expect(badgeText).not.toContain("há");
    }

    // Aciona o tooltip
    await badge.hover();
    
    // O tooltip deve aparecer (estamos usando Radix Tooltip que geralmente usa portal no final do body)
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    
    // Verifica se o tooltip contém informações mais completas (como "Regra de Preços")
    await expect(tooltip).toContainText("Regra de Preços");
    
    // Se a data for válida, o tooltip deve mostrar o status por extenso
    const tooltipText = await tooltip.innerText();
    const hasStatus = /Atualizado|Próximo do limite|Possivelmente defasado/.test(tooltipText);
    expect(hasStatus).toBe(true);
  });
});
