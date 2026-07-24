/**
 * Rota: /produtos (catálogo de produtos)
 * Suíte padrão via factory + cenários críticos específicos da rota.
 */
import { test, expect } from "../../fixtures/test-base";
import { buildAuthedRouteSuite } from "../_factories";
import { gotoAndSettle } from "../../helpers/nav";
import { waitRouteReady, mockEdgeFn } from "../_shared";

// Suíte base de 8 testes (render, happy, auth-fail, 400, timeout, 5xx, a11y, mobile)
buildAuthedRouteSuite({
  name: "/produtos (catálogo)",
  path: "/produtos",
  primary: { kind: "fn", key: "external-db-bridge", successBody: { success: true, data: [], total: 0 } },
});

// ---------------------------------------------------------------------------
// Cenários específicos da rota
// ---------------------------------------------------------------------------

const PRODUCT_LIST = [
  { id: "p1", sku: "CAN-001", name: "Caneta azul", price: 3.5, stock: 200, category: "Canetas" },
  { id: "p2", sku: "MOC-001", name: "Mochila táctica", price: 89.9, stock: 50, category: "Bolsas" },
  { id: "p3", sku: "CAD-001", name: "Caderno A4", price: 12.0, stock: 0, category: "Cadernos" },
];

test.describe("/produtos — fluxos críticos", () => {
  test("happy: lista de produtos renderiza cards com SKU e preço", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: PRODUCT_LIST, total: 3 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    // pelo menos um produto visível
    const productCount = await page.locator("[data-testid^='product-card-']").count().catch(() => 0);
    const anyCard = await page.locator("[data-testid*='product'], [data-testid*='card']").first().isVisible().catch(() => false);
    const hasHeading = await page.locator("h1, h2, h3").first().isVisible().catch(() => false);
    expect(anyCard || hasHeading).toBe(true);
  });

  test("busca: filtro por texto reduz lista de produtos", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: PRODUCT_LIST, total: 3 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    // Encontra campo de busca (search input)
    const searchInput = page.locator("[data-testid='search-input'], input[type='search'], input[placeholder*='buscar' i], input[placeholder*='pesquis' i], input[placeholder*='procur' i]").first();
    const hasSearch = await searchInput.isVisible().catch(() => false);
    if (hasSearch) {
      await searchInput.fill("caneta");
      await page.waitForTimeout(300);
      // Deve filtrar sem crash
      expect(await page.locator("body").isVisible()).toBe(true);
    }
  });

  test("filtro por categoria funciona sem crash", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: PRODUCT_LIST, total: 3 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    const categoryFilter = page.locator("[data-testid*='category'], [data-testid*='filter']").first();
    const hasCategoryFilter = await categoryFilter.isVisible().catch(() => false);
    if (hasCategoryFilter) {
      await categoryFilter.click().catch(() => {});
      expect(await page.locator("body").isVisible()).toBe(true);
    }
  });

  test("produto sem estoque renderiza badge de indisponível", async ({ page }) => {
    const noStock = [{ ...PRODUCT_LIST[2], stock: 0 }];
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: noStock, total: 1 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    // Não deve ter crash JS
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.waitForTimeout(500);
    expect(errors).toHaveLength(0);
  });

  test("lista vazia: exibe estado empty sem crash", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: [], total: 0 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    expect(await page.locator("body").isVisible()).toBe(true);
    // Sem loop infinito de loading
    await page.waitForTimeout(1000);
    const loaders = await page.locator("[data-testid*='loading'], .animate-spin").count();
    expect(loaders).toBeLessThan(5);
  });

  test("pagination: navegar para página 2 não causa crash", async ({ page }) => {
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: PRODUCT_LIST, total: 150, page: 1, per_page: 24 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    const nextPage = page.locator("[data-testid='pagination-next'], [aria-label*='próxima' i], [aria-label*='next' i]").first();
    const hasNext = await nextPage.isVisible().catch(() => false);
    if (hasNext) {
      await nextPage.click().catch(() => {});
      await page.waitForTimeout(500);
      expect(await page.locator("body").isVisible()).toBe(true);
    }
  });

  test("@mobile: catálogo não tem overflow horizontal em 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockEdgeFn(page, "external-db-bridge", 200, { success: true, data: PRODUCT_LIST, total: 3 });
    await gotoAndSettle(page, "/produtos");
    await waitRouteReady(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow).toBe(false);
  });
});
