/**
 * Header azul da lista de Orçamentos:
 *  - Cantos superiores arredondados (via `overflow-hidden` do shell + rounded-lg).
 *  - NUNCA exibe scroll horizontal próprio no banner em nenhuma largura.
 *  - Mantém comportamento "sticky" (sempre visível) ao rolar o corpo da tabela.
 */
import { expect } from "@playwright/test";
import { test } from "../../fixtures/test-base";
import { loginAs } from "../../helpers/auth";
import { gotoAndSettle } from "../../helpers/nav";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 1024, height: 720 },
  { name: "mobile-wide", width: 900, height: 720 },
] as const;

test.describe("[module:quotes] [component:quotes-list] [owner:team-growth] @regression route:/orcamentos", () => {
  for (const vp of VIEWPORTS) {
    test(`banner azul: arredondado e sem scroll lateral próprio — ${vp.name}`, async ({ page }) => {
      await loginAs(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, "/orcamentos");

      const shell = page.locator('[data-testid="quotes-table-shell"]').first();
      const banner = page.locator('[data-testid="quotes-table-banner"]').first();
      await expect(shell).toBeVisible();
      await expect(banner).toBeVisible();

      // Shell mantém os cantos arredondados (radius > 0) em todos os 4 vértices.
      const shellRadii = await shell.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          tl: parseFloat(cs.borderTopLeftRadius),
          tr: parseFloat(cs.borderTopRightRadius),
          bl: parseFloat(cs.borderBottomLeftRadius),
          br: parseFloat(cs.borderBottomRightRadius),
          overflow: cs.overflow,
        };
      });
      expect(shellRadii.tl).toBeGreaterThan(0);
      expect(shellRadii.tr).toBeGreaterThan(0);
      expect(shellRadii.bl).toBeGreaterThan(0);
      expect(shellRadii.br).toBeGreaterThan(0);
      expect(shellRadii.overflow).toMatch(/hidden|clip/);

      // Banner NÃO tem scroll horizontal próprio.
      const bannerScroll = await banner.evaluate((el) => ({
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      }));
      expect(bannerScroll.overflowX).not.toBe("auto");
      expect(bannerScroll.overflowX).not.toBe("scroll");
      // E ainda que o conteúdo coubesse, não excede o próprio box.
      expect(bannerScroll.scrollW).toBeLessThanOrEqual(bannerScroll.clientW + 1);
    });
  }

  test("banner permanece visível ao rolar verticalmente o corpo da tabela", async ({ page }) => {
    await loginAs(page);
    await gotoAndSettle(page, "/orcamentos");

    const banner = page.locator('[data-testid="quotes-table-banner"]').first();
    const scroller = page.locator('[data-testid="quotes-scroll-container"]').first();
    if ((await scroller.count()) === 0) test.skip(true, "Sem scroll container.");

    const before = await banner.boundingBox();
    await scroller.evaluate((el) => {
      el.scrollTop = 200;
    });
    const after = await banner.boundingBox();
    expect(before && after).toBeTruthy();
    if (before && after) {
      // Banner não se mexe verticalmente com o scroll do corpo.
      expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
    }
  });
});
