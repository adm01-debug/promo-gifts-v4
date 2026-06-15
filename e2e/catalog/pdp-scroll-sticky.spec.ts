import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "../helpers/nav";

/**
 * Garante que o PDP (ProductDetailHero):
 *   1. Permite scroll vertical no nível do viewport (window scroll, NÃO scroll interno do grid).
 *   2. A galeria com `lg:sticky lg:top-20` permanece fixa enquanto o lado direito rola.
 *
 * Regressão coberta: `overflow-x-hidden` no grid colapsa Y para `auto` e quebra
 * tanto a barra de rolagem da página quanto o sticky. Substituído por `overflow-x-clip`.
 */
test.describe("PDP — scroll do viewport e sticky da galeria", () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth();
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
    const firstProduct = page.locator('[data-testid="product-card"]').first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();
    await waitForRouteIdle(page);
  });

  test("window scroll funciona (grid não vira scroll container)", async ({ page }) => {
    // Página deve ter conteúdo maior que o viewport.
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(docHeight).toBeGreaterThan(viewportHeight);

    // Rola via window — se o grid estiver com overflow:auto isso falha (scrollY = 0).
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(400);

    // Garantir que o grid do hero NÃO criou scroll container vertical próprio.
    const gridOverflowY = await page.evaluate(() => {
      const grid = document.querySelector('div.grid.min-w-0.overflow-x-clip') as HTMLElement | null;
      if (!grid) return null;
      return getComputedStyle(grid).overflowY;
    });
    // overflow-x-clip mantém Y como visible (não auto/scroll).
    expect(gridOverflowY === null || gridOverflowY === 'visible' || gridOverflowY === 'clip').toBe(true);
  });

  test("galeria sticky permanece fixa ao rolar", async ({ page }) => {
    const gallery = page.locator('.lg\\:sticky.lg\\:top-20').first();
    await expect(gallery).toBeVisible();

    const beforeTop = await gallery.evaluate((el) => el.getBoundingClientRect().top);

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);

    const afterTop = await gallery.evaluate((el) => el.getBoundingClientRect().top);

    // Sticky: top em relação ao viewport deve permanecer próximo (~80px = top-20).
    // Se não fosse sticky, afterTop seria muito negativo (~ -700).
    expect(afterTop).toBeGreaterThan(-50);
    expect(Math.abs(afterTop - beforeTop)).toBeLessThan(200);
  });
});
