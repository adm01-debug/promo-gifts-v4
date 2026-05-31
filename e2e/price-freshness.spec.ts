import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

/**
 * Testes E2E para o componente PriceFreshnessBadge.
 * Verifica se o badge exibe apenas a data absoluta (DD/MM/AAAA) no modo PDP e Padrão,
 * e se os detalhes completos (relativos, regras) aparecem apenas no tooltip.
 */

test.describe("Price Freshness Badge - PDP Mode", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    // Navegar para a página de catálogo e entrar no detalhe de um produto
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await waitForRouteIdle(page);
  });

  test("Badge no PDP (variant='pdp') mostra apenas data absoluta e esconde relativo", async ({ page }) => {
    // Localiza o badge usando role status e os padrões de texto do PDP
    const badge = page.locator('[role="status"]').filter({ hasText: /Atualizado em|Data não informada|Preço pode estar defasado/ }).first();
    await expect(badge).toBeVisible();

    const badgeText = (await badge.innerText()).trim();
    
    // No modo PDP, o texto deve ser "Atualizado em DD/MM/AAAA" ou as fallbacks
    if (badgeText.includes("Atualizado em")) {
      expect(badgeText).toMatch(/^Atualizado em \d{2}\/\d{2}\/\d{4}$/);
      expect(badgeText).not.toContain("há"); // Não deve mostrar o tempo relativo no badge
    }

    // Hover para abrir tooltip
    await badge.hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();
    
    // O tooltip deve conter o detalhamento (relativo e regra)
    const tooltipText = await tooltip.innerText();
    expect(tooltipText).toContain("Regra de Preços");
    // Verifica se o texto de status (Atualizado/Próximo/Defasado) está presente
    expect(/Atualizado|Próximo do limite|Possivelmente defasado/.test(tooltipText)).toBe(true);
  });
});

test.describe("Price Freshness Badge - Standard/Inline Mode", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    // O modo inline/standard é usado no Quick View ou em seções de detalhe rápido
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
  });

  test("Badge no catálogo/Quick View (variant='inline') mostra apenas data absoluta", async ({ page }) => {
    // Abrir o Quick View (se disponível) ou verificar se há um badge inline no card
    // Como o usuário mencionou "Padrão", verificamos a variant='inline'
    const productCard = page.locator('[data-testid="product-card"]').first();
    await productCard.hover(); // Aciona botões de ação rápida se existirem
    
    // Procurar por um badge de freshness no catálogo
    // Se não houver badge inline direto no card, tentamos o Quick View
    const quickViewBtn = productCard.locator('button:has-text("Visualização Rápida"), button[title="Visualização Rápida"]').first();
    
    if (await quickViewBtn.isVisible()) {
      await quickViewBtn.click();
      // No Quick View o badge costuma ser variant="inline"
      const badge = page.locator('[role="status"]').filter({ hasText: /Atualizado em|Data não informada/ }).first();
      await expect(badge).toBeVisible();

      const badgeText = (await badge.innerText()).trim();
      
      // Mesmo comportamento: essencial no badge, completo no tooltip
      if (badgeText.includes("Atualizado em")) {
        expect(badgeText).toMatch(/^Atualizado em \d{2}\/\d{2}\/\d{4}$/);
        expect(badgeText).not.toContain("há");
      }

      await badge.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      expect(await tooltip.innerText()).toContain("Regra de Preços");
    } else {
      // Fallback: se estiver testando em uma página onde o badge inline já é visível
      const badge = page.locator('[role="status"]').filter({ hasText: /Atualizado em/ }).first();
      if (await badge.isVisible()) {
        const text = await badge.innerText();
        expect(text).toMatch(/Atualizado em \d{2}\/\d{2}\/\d{4}/);
        expect(text).not.toContain("há");
      }
    }
  });
});

