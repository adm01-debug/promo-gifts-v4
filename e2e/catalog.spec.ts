/**
 * E2E: Catalog & Filters - All critical routes
 */
import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { expectVisibleByTestId } from "./helpers/waits";
import { loginAs } from "./helpers/auth";

test.describe("Catalog & Filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("should display product list and filters", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await expectVisibleByTestId(page, "product-grid");
    await expectVisibleByTestId(page, "product-filters");
  });

  test("should apply combined filters and preserve state in URL", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    
    // Open categories
    await page.locator('[data-testid="filter-section-categorias"]').click();
    const firstCategory = page.locator('[data-testid="category-filter-item"]').first();
    const categoryName = await firstCategory.innerText();
    await firstCategory.click();
    
    // Apply price filter
    await page.locator('[data-testid="filter-section-preco"]').click();
    await page.locator('input[placeholder="Ex: 0"]').first().fill("50");
    await page.locator('input[placeholder="Sem limite"]').first().fill("200");
    
    // Wait for network/results update
    await page.waitForTimeout(1000);
    
    // Check URL
    expect(page.url()).toContain("priceRange=50");
    expect(page.url()).toContain("priceRange=200");
    
    // Reload and check if filters persist
    await page.reload();
    await expect(page.locator('[data-testid="active-filter-badge"]')).toContainText(categoryName.trim());
  });

  test("should handle sorting options", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const sortTrigger = page.locator('[data-testid="sort-select-trigger"]');
    await sortTrigger.click();
    await page.locator('role=option[name="Preço: Menor para Maior"]').click();
    
    await page.waitForTimeout(500);
    expect(page.url()).toContain("sortBy=price_asc");
  });

  test("should display correct empty state for impossible filter combination", async ({ page }) => {
    await gotoAndSettle(page, "/produtos?priceRange=0&priceRange=1&q=impossibleproductname");
    const emptyState = page.locator('[data-testid="empty-catalog-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("Nenhum produto encontrado");
  });

  test("should navigate through pagination", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    const nextPage = page.locator('[data-testid="pagination-next"]');
    if (await nextPage.isVisible()) {
      await nextPage.click();
      expect(page.url()).toContain("page=2");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Regression — Fix #40 (commit 208e80a)
  // mapLightweightToProduct() retornava "Sem categoria" hardcoded para
  // 100% dos cards. Após o fix, a maioria carrega o nome real via map
  // pré-fetch. O threshold aceita ≤5% para tolerar produtos sem
  // category_id ou queries em paralelo.
  // ────────────────────────────────────────────────────────────────────
  test("catalog cards exibem o nome real da categoria (não 'Sem categoria')", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await expectVisibleByTestId(page, "product-grid");

    // Aguarda primeiro card hidratar
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const totalCards = await page.locator('[data-testid="product-card"]').count();
    if (totalCards === 0) {
      test.skip(true, "Sem cards renderizados — provavelmente sem dados.");
      return;
    }

    // Conta cards cujo badge de categoria diz literalmente "Sem categoria".
    // Antes do fix #40, isso era 100% dos cards.
    const badgesSemCat = page.locator('[data-testid="product-card"]').locator("text=Sem categoria");
    const countSem = await badgesSemCat.count();
    const ratio = countSem / totalCards;
    expect(
      ratio,
      `${countSem}/${totalCards} cards ainda exibem 'Sem categoria' (regressão do fix #40)`,
    ).toBeLessThanOrEqual(0.05);
  });

  // ────────────────────────────────────────────────────────────────────
  // Regression — Fix #41 (commit 0676f73)
  // OptimizedImage perdia o onLoad interno quando o consumer passava o
  // próprio. Resultado: opacity-0 permanente em todos os <img>.
  // Aqui asseguramos que após carga, imagens estão visíveis
  // (opacity-100 ou sem classe opacity-0).
  // ────────────────────────────────────────────────────────────────────
  test("OptimizedImage transiciona para opacity-100 após carregar", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");
    await expectVisibleByTestId(page, "product-grid");

    // Aguarda primeira imagem do grid carregar (event 'load' real do browser)
    const firstImg = page.locator('[data-testid="product-grid"] img').first();
    await expect(firstImg).toBeVisible({ timeout: 15_000 });
    await firstImg.evaluate((el: HTMLImageElement) => {
      if (el.complete && el.naturalWidth > 0) return;
      return new Promise<void>((resolve) => {
        el.addEventListener("load", () => resolve(), { once: true });
        el.addEventListener("error", () => resolve(), { once: true });
      });
    });

    // Conta quantas imagens permaneceram em opacity-0 (regressão)
    const opacityZero = await page.locator('[data-testid="product-grid"] img.opacity-0').count();
    const totalImgs = await page.locator('[data-testid="product-grid"] img').count();
    if (totalImgs === 0) {
      test.skip(true, "Sem <img> no grid — provavelmente sem dados.");
      return;
    }
    // Permitimos até 20% ainda em opacity-0 (cards abaixo do viewport / lazy load).
    expect(
      opacityZero / totalImgs,
      `${opacityZero}/${totalImgs} imgs ficaram com opacity-0 após carga`,
    ).toBeLessThanOrEqual(0.2);
  });
});
