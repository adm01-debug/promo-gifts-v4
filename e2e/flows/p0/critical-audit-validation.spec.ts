import { test, expect } from "../../fixtures/test-base";
import { gotoAndSettle, expectOnRoute } from "../../helpers/nav";
import { loginAs } from "../../helpers/auth";
import { expectVisibleByTestId } from "../../helpers/waits";

test.describe("Auditoria Técnica - Fluxos Críticos", () => {
  test.beforeEach(async ({ page }) => {
    // Garantir que estamos logados para acessar rotas protegidas
    await loginAs(page);
  });

  test("Fluxo: Login -> Catálogo -> Filtros -> Estabilidade de Layout", async ({ page }) => {
    // 1. Navegação para Catálogo
    await gotoAndSettle(page, "/produtos");
    await expectVisibleByTestId(page, "product-grid");

    // 2. Mudança de Classificação (Sort)
    const sortTrigger = page.locator('[data-testid="sort-select-trigger"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Preço: Menor para Maior"]').click();
    
    // Validar que a URL reflete o sortBy mas o viewMode permanece o mesmo (default grid)
    await expect(page).toHaveURL(/sortBy=price_asc/);
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    // 3. Mudança de ViewMode (Grid -> Lista -> Tabela)
    // Validar que ao trocar o sort, o viewMode NÃO oscila
    await page.locator('[data-testid="view-mode-list"]').click();
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();
    
    await sortTrigger.click();
    await page.locator('role=option[name="Preço: Maior para Menor"]').click();
    
    // O layout deve CONTINUAR em lista mesmo após mudar o sort
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-grid"]')).not.toBeVisible();
  });

  test("Estabilidade Visual: FAB de Ações Rápidas vs Voltar ao Topo", async ({ page }) => {
    const viewports = [
      { width: 320, height: 568, name: "Mobile Small" },
      { width: 375, height: 812, name: "Mobile iPhone" },
      { width: 768, height: 1024, name: "Tablet" },
      { width: 1440, height: 900, name: "Desktop" }
    ];

    for (const vp of viewports) {
      test.step(`Validando viewport: ${vp.name}`, async () => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, "/produtos");

        // Scroll para baixo para ativar os botões flutuantes
        await page.evaluate(() => window.scrollTo(0, 1000));
        await page.waitForTimeout(500); // Aguarda transição CSS

        const fab = page.locator('[data-testid="quick-quote-fab"], button[aria-label*="Ações rápidas"]').first();
        const scrollToTop = page.locator('[data-testid="scroll-to-top"], button[aria-label*="voltar ao topo"]').first();

        await expect(fab).toBeVisible();
        await expect(scrollToTop).toBeVisible();

        // Verificar sobreposição (BoundingBox)
        const fabBox = await fab.boundingBox();
        const scrollBox = await scrollToTop.boundingBox();

        if (fabBox && scrollBox) {
          const hasOverlap = !(
            fabBox.x + fabBox.width < scrollBox.x ||
            fabBox.x > scrollBox.x + scrollBox.width ||
            fabBox.y + fabBox.height < scrollBox.y ||
            fabBox.y > scrollBox.y + scrollBox.height
          );
          
          expect(hasOverlap, `Botões estão se sobrepondo em ${vp.name}`).toBeFalsy();
          
          // Verificar distância mínima (ex: 10px)
          const distance = Math.abs(fabBox.y - scrollBox.y);
          expect(distance, `Distância insuficiente entre botões em ${vp.name}`).toBeGreaterThan(40);
        }
      });
    }
  });

  test("Fluxo Completo: Catálogo -> Detalhe -> Novo Orçamento", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Pegar o primeiro produto
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await expect(firstProduct).toBeVisible();
    
    // Clicar para ver detalhes
    await firstProduct.click();
    await expect(page).toHaveURL(/\/produto\//);
    
    // Clicar em "Adicionar ao Orçamento" ou "Novo Orçamento" no FAB
    const fab = page.locator('button[aria-label*="Ações rápidas"]').first();
    await fab.click();
    await page.locator('text=Novo Orçamento').click();

    // Validar que redirecionou para o wizard de orçamento com o produto
    await expectOnRoute(page, /\/orcamentos\/novo/);
    await expect(page).toHaveURL(/productId=/);
    
    // Validar carregamento da página de orçamento
    await expectVisibleByTestId(page, "quote-builder-stepper");
  });
});
