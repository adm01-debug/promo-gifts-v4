import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle, expectOnRoute } from "../helpers/nav";

/**
 * Fluxo real: catálogo → PDP → validar scroll + sticky.
 *
 * Diferente do `pdp-scroll-sticky.spec.ts` (que vai direto ao detalhe via
 * helpers), aqui simulamos o caminho do usuário:
 *   1. /produtos (catálogo)
 *   2. clica no primeiro card
 *   3. confirma que a URL virou /produto/:id
 *   4. valida scroll do viewport e sticky da galeria
 *
 * Garante que o fluxo real (com transições de rota, lazy chunks, prefetch)
 * não introduz regressões no scroll/sticky do PDP.
 */
test.describe("PDP — fluxo catálogo → detalhe → scroll/sticky", () => {
  test("navega do catálogo até o PDP e valida scroll + sticky", async ({ page }) => {
    await requireAuth();
    await page.setViewportSize({ width: 1366, height: 768 });

    // 1. Catálogo
    await gotoAndSettle(page, "/produtos");
    await waitForRouteIdle(page);
    await expectOnRoute(page, /\/produtos/);

    const firstCard = page.locator('[data-testid="product-card"]').first();
    await expect(firstCard, "catálogo sem cards de produto").toBeVisible();

    // 2. Click no card → PDP
    await firstCard.click();
    await waitForRouteIdle(page);

    // 3. Confirma transição para /produto/:id
    await expectOnRoute(page, /\/produto\//);

    // Aguarda o hero carregar
    const heroGrid = page
      .locator('div.grid.min-w-0')
      .filter({ has: page.locator('.lg\\:sticky.lg\\:top-20') })
      .first();
    await expect(heroGrid, "hero do PDP não renderizou após navegação").toBeVisible();

    // 4a. Guarda anti-regressão: hero grid NUNCA pode usar overflow-x-hidden
    const heroState = await heroGrid.evaluate((el) => ({
      className: el.className,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(
      heroState.className,
      "regressão: hero grid voltou a usar overflow-x-hidden — use overflow-x-clip",
    ).not.toContain('overflow-x-hidden');
    expect(['visible', 'clip']).toContain(heroState.overflowY);

    // 4b. Scroll do viewport funciona
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(docHeight).toBeGreaterThan(viewportHeight);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, "window.scrollY deve avançar após navegação real do catálogo").toBeGreaterThan(400);

    // 4c. Galeria sticky permanece alinhada a ~80px (lg:top-20 = 5rem)
    const gallery = page.locator('.lg\\:sticky.lg\\:top-20').first();
    const EXPECTED_TOP = 80;
    const TOLERANCE = 16;

    for (const y of [400, 900, 1400]) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(250);
      const currentY = await page.evaluate(() => window.scrollY);
      if (currentY < 100) continue;
      const top = await gallery.evaluate((el) => el.getBoundingClientRect().top);
      expect(
        Math.abs(top - EXPECTED_TOP),
        `sticky quebrado após nav do catálogo em scrollY=${currentY}: top=${top}px (esperado ~${EXPECTED_TOP}px)`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});
