import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle, waitForRouteIdle } from "../helpers/nav";

/**
 * PDP — scroll do viewport + sticky da galeria.
 *
 * Regressão coberta: `overflow-x-hidden` no grid do hero colapsa Y para
 * `overflow-y:auto` (spec CSS), quebrando (a) a barra de rolagem da página
 * e (b) o `lg:sticky lg:top-20` da galeria. Fix: `overflow-x-clip`.
 */
test.describe("PDP — scroll viewport e sticky da galeria", () => {
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

  test("hero grid NUNCA usa overflow-x-hidden (guarda anti-regressão)", async ({ page }) => {
    const heroGridState = await page.evaluate(() => {
      // Localiza o grid do hero pela combinação de classes únicas.
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>('div.grid.min-w-0'),
      ).filter((el) => el.className.includes('lg:grid-cols-'));
      const grid = candidates[0] ?? null;
      if (!grid) return null;
      const cs = getComputedStyle(grid);
      return {
        className: grid.className,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
      };
    });

    expect(heroGridState, "hero grid não encontrado no DOM").not.toBeNull();
    expect(
      heroGridState!.className,
      "regressão: hero grid voltou a usar overflow-x-hidden — use overflow-x-clip",
    ).not.toContain('overflow-x-hidden');
    // overflow-x-clip mantém Y como visible (NUNCA auto/scroll/hidden).
    expect(['visible', 'clip']).toContain(heroGridState!.overflowY);
  });

  test("window scroll funciona (grid não vira scroll container)", async ({ page }) => {
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(docHeight).toBeGreaterThan(viewportHeight);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(200);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, "window.scrollY deve avançar — se = 0, scroll está preso em container interno").toBeGreaterThan(400);
  });

  test("galeria sticky permanece alinhada ao top-20 (~80px) durante o scroll", async ({ page }) => {
    const gallery = page.locator('.lg\\:sticky.lg\\:top-20').first();
    await expect(gallery).toBeVisible();

    // top-20 do Tailwind = 5rem = 80px (com root font-size padrão 16px).
    const EXPECTED_TOP = 80;
    const TOLERANCE = 16; // headers/banners podem deslocar levemente.

    // Mede em vários offsets de scroll para garantir que continua sticky.
    const samples = [0, 400, 900, 1400];
    const measurements: Array<{ scrollY: number; top: number }> = [];

    for (const y of samples) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(250);
      const top = await gallery.evaluate((el) => el.getBoundingClientRect().top);
      const currentY = await page.evaluate(() => window.scrollY);
      measurements.push({ scrollY: currentY, top });
    }

    // Para todos os offsets onde o scroll efetivamente aconteceu (> 0),
    // o top da galeria deve permanecer próximo de EXPECTED_TOP.
    const scrolled = measurements.filter((m) => m.scrollY > 100);
    expect(scrolled.length, "página não rolou o suficiente para validar sticky").toBeGreaterThan(0);

    for (const m of scrolled) {
      expect(
        Math.abs(m.top - EXPECTED_TOP),
        `sticky quebrado em scrollY=${m.scrollY}: top=${m.top}px (esperado ~${EXPECTED_TOP}px)`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});
