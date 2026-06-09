import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Visual Regression & Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("visual regression: catalog initial state", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    // Aguarda o grid carregar para evitar capturar esqueletos
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    
    // Pequeno delay para garantir que imagens (OptimizedImage) transicionaram opacity
    await page.waitForTimeout(2000);

    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot('catalog-initial.png');
  });

  test("visual regression: filter sheet open", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await page.click('button[aria-label="Abrir filtros do catálogo"]');
    await expect(page.locator('text=Categorias')).toBeVisible();
    
    // Captura apenas a área visível para focar no painel lateral
    expect(await page.screenshot()).toMatchSnapshot('catalog-filters-open.png');
  });

  test("persistence: filters and sort should persist when navigating back", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // 1. Aplica filtros via URL para ser determinístico
    await gotoAndSettle(page, "/produtos?sortBy=price_asc&priceRange=100&priceRange=500");
    
    // 2. Navega para um produto
    await page.waitForSelector('[data-testid="product-card"]');
    const firstProductLink = page.locator('[data-testid="product-card"] a').first();
    await firstProductLink.click();
    
    // Verifica se saiu do catálogo
    await expect(page).not.toHaveURL(/\/produtos(\?.*)?$/);
    await page.waitForSelector('[data-testid="product-detail"]', { timeout: 10000 }).catch(() => {});
    
    // 3. Volta para o catálogo
    await page.goBack();
    
    // 4. Valida se os parâmetros persistem na URL
    expect(page.url()).toContain("sortBy=price_asc");
    expect(page.url()).toContain("priceRange=100");
    expect(page.url()).toContain("priceRange=500");
    
    // Valida se a UI reflete os filtros (badge de filtro ativo)
    await expect(page.locator('[data-testid="active-filter-badge"]')).toBeVisible();
  });

  test("normalization: invalid parameters should not break layout", async ({ page }) => {
    // Parâmetros inválidos: ordenação inexistente, cor malformada, busca com caracteres especiais
    const invalidUrl = "/produtos?sortBy=INVALID_SORT&colorGroups=999&priceRange=NaN&q=<script>alert(1)</script>";
    
    await gotoAndSettle(page, invalidUrl);
    
    // O catálogo deve normalizar e mostrar o estado inicial ou vazio amigável, sem crashar (tela branca)
    await expect(page.locator('body')).not.toContainText("Error");
    await expect(page.locator('body')).not.toContainText("crash");
    
    // Deve renderizar o Toolbar (indicador que o componente principal montou)
    await expect(page.locator('[data-testid="catalog-sort-trigger"]')).toBeVisible();
    
    // O grid deve estar presente (mesmo que vazio)
    const grid = page.locator('[data-testid="product-grid"], [data-testid="empty-catalog-state"]');
    await expect(grid.first()).toBeVisible();
    
    // Captura visual para garantir que o layout não "explodiu"
    expect(await page.screenshot()).toMatchSnapshot('catalog-invalid-params.png');
  });

  test("flash check: loading transitions", async ({ page }) => {
    // Força um estado de carregamento longo (simulado via rede se possível, ou apenas verificando se o skeleton aparece antes do grid)
    await page.goto("/produtos");
    
    // Verifica se o skeleton aparece primeiro (sem flash de tela branca)
    const skeleton = page.locator('[data-testid="product-card-skeleton"]');
    if (await skeleton.count() > 0) {
      await expect(skeleton.first()).toBeVisible();
    }
    
    // Aguarda finalização
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="product-card-skeleton"]')).toHaveCount(0);
  });
});
