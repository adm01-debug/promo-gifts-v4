import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { loginAs } from "./helpers/auth";

test.describe("Catalog Visual Regression & Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("visual regression: catalog initial state", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    expect(await page.screenshot({ fullPage: true })).toMatchSnapshot('catalog-initial.png');
  });

  test("visual regression: filter sheet open", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await page.click('button[aria-label="Abrir filtros do catálogo"]');
    await expect(page.locator('text=Categorias')).toBeVisible();
    expect(await page.screenshot()).toMatchSnapshot('catalog-filters-open.png');
  });

  test("persistence: filters and sort should persist when navigating back", async ({ page }) => {
    // 1. Aplica filtros e ordenação via URL para ser determinístico
    // Note: useCatalogState usa sortBy como param, priceRange como array
    await gotoAndSettle(page, "/produtos?sort=price-asc&priceRange=100&priceRange=500");
    
    // 2. Aguarda os cards carregarem
    await page.waitForSelector('[data-testid="product-card"]');
    
    // 3. Navega para um produto clicando no link do card
    const firstProductLink = page.locator('[data-testid="product-card"] a').first();
    await firstProductLink.click();
    
    // 4. Verifica se saiu do catálogo e está na PDP
    await expect(page).toHaveURL(/\/produto\/.*/);
    
    // 5. Volta para o catálogo usando o botão voltar do browser
    await page.goBack();
    
    // 6. Valida se os parâmetros persistem na URL e a UI reflete o estado
    await expect(page).toHaveURL(/\/produtos\?.*sort=price-asc.*/);
    await expect(page).toHaveURL(/\/produtos\?.*priceRange=100.*/);
    
    // Verifica badge de filtro ativo
    await expect(page.locator('[data-testid="active-filter-badge"]')).toBeVisible();
  });

  test("normalization: invalid parameters should not break layout", async ({ page }) => {
    // Parâmetros inválidos: ordenação inexistente, cor inexistente, price malformado
    const invalidUrl = "/produtos?sort=INVALID_SORT&colorGroups=999&priceRange=NaN&q=<script>alert(1)</script>";
    
    await gotoAndSettle(page, invalidUrl);
    
    // O catálogo deve normalizar e não crashar (sem tela branca)
    await expect(page.locator('body')).not.toContainText("Error");
    
    // Deve renderizar o Toolbar (indicador que o componente principal montou)
    await expect(page.locator('[data-testid="catalog-sort-trigger"]')).toBeVisible();
    
    // O grid deve estar presente (ou empty state se filtrar tudo)
    const gridOrEmpty = page.locator('[data-testid="product-grid"], [data-testid="empty-catalog-state"]');
    await expect(gridOrEmpty.first()).toBeVisible();
    
    expect(await page.screenshot()).toMatchSnapshot('catalog-invalid-params.png');
  });

  test("flash check: loading transitions", async ({ page }) => {
    await page.goto("/produtos");
    
    // Verifica se o skeleton aparece primeiro
    const skeleton = page.locator('[data-testid="product-card-skeleton"]');
    if (await skeleton.count() > 0) {
      await expect(skeleton.first()).toBeVisible();
    }
    
    // Aguarda finalização e garante que o skeleton sumiu
    await page.waitForSelector('[data-testid="product-card"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="product-card-skeleton"]')).toHaveCount(0);
  });
});

