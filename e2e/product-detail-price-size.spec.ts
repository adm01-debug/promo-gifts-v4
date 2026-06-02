/**
 * PDP — Tamanhos do preço (após redução de 25%).
 *
 * Valida que:
 *  - O valor do preço usa 22.5px (1.40625rem) abaixo de xl
 *  - Em viewport ≥ 1280px (xl) usa 27px (1.6875rem)
 *  - O sufixo "/un" usa text-xs (12px)
 *  - O alinhamento baseline entre preço e sufixo é mantido
 */
import { test, expect, requireAuth } from "./fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "./helpers/nav";

const PX_VALUE_BASE = 22.5; // 1.40625rem
const PX_VALUE_XL = 27; // 1.6875rem
const PX_UNIT = 12; // text-xs

async function openFirstProduct(page: import("@playwright/test").Page) {
  await gotoAndSettle(page, "/produtos");
  await waitForRouteIdle(page);
  const first = page.locator('[data-testid="product-card"]').first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click();
  await waitForRouteIdle(page);
  await expect(page.locator('[data-testid="pdp-price-value"]')).toBeVisible({ timeout: 15_000 });
}

test.describe("PDP — Tamanhos do preço", () => {
  test.beforeEach(() => requireAuth());

  test("valor 22.5px e sufixo 12px em viewport < xl (1024px)", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openFirstProduct(page);

    const valueFs = await page
      .locator('[data-testid="pdp-price-value"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const unitFs = await page
      .locator('[data-testid="pdp-price-unit"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(valueFs).toBeCloseTo(PX_VALUE_BASE, 1);
    expect(unitFs).toBeCloseTo(PX_UNIT, 1);
  });

  test("valor 27px em viewport xl (≥ 1280px)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openFirstProduct(page);

    const valueFs = await page
      .locator('[data-testid="pdp-price-value"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const unitFs = await page
      .locator('[data-testid="pdp-price-unit"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(valueFs).toBeCloseTo(PX_VALUE_XL, 1);
    expect(unitFs).toBeCloseTo(PX_UNIT, 1);
  });

  test("preço e sufixo /un alinham na mesma baseline em múltiplas larguras", async ({ page }) => {
    for (const width of [390, 768, 1024, 1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await openFirstProduct(page);

      const row = page.locator('[data-testid="pdp-price-row"]');
      await expect(row).toBeVisible();
      const align = await row.evaluate((el) => getComputedStyle(el).alignItems);
      expect(align).toBe("baseline");

      const valueBox = await page.locator('[data-testid="pdp-price-value"]').boundingBox();
      const unitBox = await page.locator('[data-testid="pdp-price-unit"]').boundingBox();
      expect(valueBox && unitBox).toBeTruthy();
      if (valueBox && unitBox) {
        // Sufixo deve ficar à direita do valor (hierarquia preservada).
        expect(unitBox.x).toBeGreaterThan(valueBox.x);
        // Sufixo deve ser visualmente menor que o valor.
        expect(unitBox.height).toBeLessThan(valueBox.height);
      }
    }
  });
});
