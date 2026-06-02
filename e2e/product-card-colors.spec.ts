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

  test('fallback "Cores indisponíveis" quando o produto não tem cores', async ({ page }) => {
    await openCatalog(page, 1366);
    const fallback = page.locator('[data-testid="colors-unavailable"]').first();
    if ((await fallback.count()) === 0) {
      test.skip(true, "Nenhum produto sem cores no catálogo.");
      return;
    }
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveText(/Cores indisponíveis/i);
  });

  test("clicar numa swatch navega ao PDP refletindo cor/hex na URL", async ({ page }) => {
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

  test("hierarquia visual estável em múltiplas larguras", async ({ page }) => {
    for (const width of VIEWPORTS) {
      await openCatalog(page, width);

      const card = page.locator('[data-testid="product-card"]').first();
      const name = card.locator('[data-testid="product-card-name"]').first();
      const priceRow = card.locator('[data-testid="product-card-price-row"]').first();
      await expect(name).toBeVisible();
      await expect(priceRow).toBeVisible();

      const anchor = card
        .locator(
          '[data-testid="product-colors-container"], [data-testid="colors-unavailable"], [data-testid="colors-empty-hidden"], [data-testid="colors-loading-skeleton"]',
        )
        .first();
      await expect(anchor).toHaveCount(1);

      const nameBox = await name.boundingBox();
      const anchorBox = await anchor.boundingBox();
      const priceBox = await priceRow.boundingBox();
      expect(nameBox && anchorBox && priceBox).toBeTruthy();
      if (nameBox && anchorBox && priceBox) {
        expect(anchorBox.y).toBeGreaterThanOrEqual(nameBox.y);
        expect(priceBox.y).toBeGreaterThanOrEqual(anchorBox.y);
      }
    }
  });
});
