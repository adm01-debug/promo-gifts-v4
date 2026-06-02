/**
 * ProductCard — Comportamento de cores no Grid.
 *
 * Valida:
 *  - Skeleton `colors-loading-skeleton` enquanto `colors === undefined`.
 *  - Render de bolinhas `color-swatch-<slug>` + tooltip `color-tooltip-content`.
 *  - Overflow `color-swatch-overflow` (+N) com tooltip listando o restante.
 *  - Fallback `colors-unavailable` quando `colors === []`.
 *  - Clique em swatch navega ao PDP com `?cor=&hex=` na URL.
 *  - Layout estável em 390 / 768 / 1024 / 1366 — preço/nome não quebram.
 *  - Regressão visual (snapshots).
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

const VIEWPORTS = [390, 768, 1024, 1366] as const;

async function openCatalog(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await gotoAndSettle(page, "/produtos");
  await waitForRouteIdle(page);
  await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Mock de cores para um produto específico para testar limites (0, 1, 6, 7)
 */
async function mockProductColors(page: import("@playwright/test").Page, colors: any[]) {
  await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        // Simula o retorno de cores indexado por ID de produto
        // Pegamos o primeiro produto do catálogo e injetamos as cores nele
        data: {
          'any-id': colors
        }
      })
    });
  });
}

test.describe("ProductCard — Cores no Grid", () => {
  test.beforeEach(() => requireAuth());

  test("skeleton aparece enquanto cores não chegaram", async ({ page }) => {
    await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    await gotoAndSettle(page, "/produtos");

    const skeleton = page.locator('[data-testid="colors-loading-skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: 10_000 });
    await expect(skeleton.locator('[data-testid="color-skeleton-dot"]')).toHaveCount(3);
  });

  test("renderiza bolinhas com tooltip e respeita +N overflow", async ({ page }) => {
    await openCatalog(page, 1366);

    const cardWithColors = page
      .locator('[data-testid="product-card"]')
      .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
      .first();

    if ((await cardWithColors.count()) === 0) {
      test.skip(true, "Nenhum card com cores disponível no catálogo.");
      return;
    }

    const first = cardWithColors.locator('[data-testid^="color-swatch-"]').first();
    const expectedName = (await first.getAttribute("data-color-name")) ?? "";
    await first.hover();
    const tooltip = page.locator('[data-testid="color-tooltip-content"]').first();
    await expect(tooltip).toBeVisible({ timeout: 5_000 });
    await expect(tooltip).toHaveText(expectedName, { ignoreCase: true });

    const overflow = cardWithColors.locator('[data-testid="color-swatch-overflow"]');
    if ((await overflow.count()) > 0) {
      await overflow.hover();
      await expect(
        page.locator('[data-testid="color-overflow-tooltip"]').first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('fallback "Cores indisponíveis" quando o produto não tem cores (0 cores)', async ({ page }) => {
    // Forçamos o mock para retornar array vazio
    await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      // Limpa todas as cores de todos os produtos no mock
      if (json.data) {
        Object.keys(json.data).forEach(id => json.data[id] = []);
      }
      await route.fulfill({ response, json });
    });

    await openCatalog(page, 1366);
    const fallback = page.locator('[data-testid="colors-unavailable"]').first();
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveText(/Cores indisponíveis/i);
  });

  test('exibe exatamente 1 cor sem overflow', async ({ page }) => {
    await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data) {
        Object.keys(json.data).forEach(id => json.data[id] = [{ name: 'Azul', hex: '#0000FF' }]);
      }
      await route.fulfill({ response, json });
    });

    await openCatalog(page, 1366);
    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card.locator('[data-testid^="color-swatch-azul"]')).toBeVisible();
    await expect(card.locator('[data-testid="color-swatch-overflow"]')).not.toBeVisible();
  });

  test('exibe 6 cores (limite) sem overflow', async ({ page }) => {
    await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data) {
        const sixColors = Array.from({ length: 6 }, (_, i) => ({ name: `Cor ${i}`, hex: '#CCC' }));
        Object.keys(json.data).forEach(id => json.data[id] = sixColors);
      }
      await route.fulfill({ response, json });
    });

    await openCatalog(page, 1366);
    const card = page.locator('[data-testid="product-card"]').first();
    await expect(card.locator('[data-testid^="color-swatch-"]')).toHaveCount(6);
    await expect(card.locator('[data-testid="color-swatch-overflow"]')).not.toBeVisible();
  });

  test('exibe +N overflow com 7+ cores e permite seleção no tooltip', async ({ page }) => {
    await page.route(/products-colors-batch|product[-_]colors/i, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (json.data) {
        const sevenColors = Array.from({ length: 7 }, (_, i) => ({ name: `Cor ${i}`, hex: '#CCC' }));
        Object.keys(json.data).forEach(id => json.data[id] = sevenColors);
      }
      await route.fulfill({ response, json });
    });

    await openCatalog(page, 1366);
    const card = page.locator('[data-testid="product-card"]').first();
    const overflow = card.locator('[data-testid="color-swatch-overflow"]');
    await expect(overflow).toHaveText('+1');
    
    // Abre o tooltip
    await overflow.hover();
    const tooltip = page.locator('[data-testid="color-overflow-tooltip"]');
    await expect(tooltip).toBeVisible();
    
    // Tenta clicar na cor escondida (Cor 6)
    const hiddenSwatch = tooltip.locator('[data-testid="color-swatch-hidden-cor-6"]');
    await expect(hiddenSwatch).toBeVisible();
    await hiddenSwatch.click();
    
    await waitForRouteIdle(page);
    await expect(page).toHaveURL(/cor=Cor%206/i, { timeout: 10_000 });
  });

  test("clicar numa swatch visível navega ao PDP refletindo cor/hex na URL", async ({ page }) => {
    await openCatalog(page, 1366);

    const cardWithColors = page
      .locator('[data-testid="product-card"]')
      .filter({ has: page.locator('[data-testid^="color-swatch-"]') })
      .first();

    if ((await cardWithColors.count()) === 0) {
      test.skip(true, "Sem cards com cores para testar seleção.");
      return;
    }

    const swatch = cardWithColors.locator('[data-testid^="color-swatch-"]').first();
    const colorName = (await swatch.getAttribute("data-color-name")) ?? "";
    expect(colorName.length).toBeGreaterThan(0);

    await swatch.click();
    await waitForRouteIdle(page);

    await expect(page).toHaveURL(/\/produto\/[^?]+\?.*cor=/i, { timeout: 10_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get("cor")?.toLowerCase()).toBe(colorName.toLowerCase());
  });

  test("regressão visual e estabilidade de layout", async ({ page }) => {
    for (const width of VIEWPORTS) {
      await openCatalog(page, width);

      const card = page.locator('[data-testid="product-card"]').first();
      await expect(card).toBeVisible();
      
      // Captura snapshot do card para garantir que nada se sobrepõe
      await expect(card).toHaveScreenshot(`product-card-${width}px.png`, {
        maxDiffPixelRatio: 0.02
      });

      const name = card.locator('[data-testid="product-card-name"]').first();
      const priceRow = card.locator('[data-testid="product-card-price-row"]').first();
      
      const anchor = card
        .locator(
          '[data-testid="product-colors-container"], [data-testid="colors-unavailable"], [data-testid="colors-empty-hidden"], [data-testid="colors-loading-skeleton"]',
        )
        .first();

      const nameBox = await name.boundingBox();
      const anchorBox = await anchor.boundingBox();
      const priceBox = await priceRow.boundingBox();
      
      if (nameBox && anchorBox && priceBox) {
        // Validação de hierarquia vertical
        expect(anchorBox.y).toBeGreaterThanOrEqual(nameBox.y);
        expect(priceBox.y).toBeGreaterThanOrEqual(anchorBox.y);
      }
    }
  });
});