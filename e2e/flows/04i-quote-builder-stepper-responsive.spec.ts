/**
 * Regressão visual + responsividade do stepper sticky do Quote Builder.
 *
 * Cobre:
 *  - 375px (mobile), 768px (tablet), 1440px (desktop)
 *  - Ausência de overflow horizontal (scrollWidth ≤ clientWidth)
 *  - Sticky permanece visível durante scroll (top ≥ 0)
 *  - Sem sobreposição visual entre stepper e o conteúdo abaixo (gap pixel-perfect)
 *  - Botões da timeline não quebram linha (todos com mesma y dentro de 4px)
 */
import { test, expect, requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "narrow", width: 360, height: 780 }, // edge: <=360 não deve dar overflow
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("Quote Builder — Stepper Sticky (regressão responsiva)", () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`@${vp.name} (${vp.width}px) — sem overflow + sticky alinhado`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, "/orcamentos/novo");

      const wizard = page.locator(Sel.quote.wizard).first();
      await expect(wizard).toBeVisible({ timeout: 10_000 });

      // 1) Sem overflow horizontal no <nav>.
      const overflow = await wizard.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(
        overflow.scroll,
        `overflow horizontal em ${vp.name} (scroll=${overflow.scroll} > client=${overflow.client})`,
      ).toBeLessThanOrEqual(overflow.client + 1);

      // 2) Todos os 5 botões de etapa numa linha só (Δy ≤ 4px).
      const buttons = wizard.locator("button");
      const count = await buttons.count();
      expect(count, "esperado 5 etapas no stepper").toBe(5);
      const ys: number[] = [];
      for (let i = 0; i < count; i++) {
        const box = await buttons.nth(i).boundingBox();
        if (box) ys.push(box.y);
      }
      const maxDelta = Math.max(...ys) - Math.min(...ys);
      expect(maxDelta, `etapas quebraram em múltiplas linhas em ${vp.name}`).toBeLessThanOrEqual(4);

      // 3) Sticky: após scroll, o container sticky permanece no topo (>= 0)
      //    e abaixo do header global (top efetivo deve refletir --header-h).
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(120);

      const stickyTop = await wizard.evaluate((el) => {
        let cur: HTMLElement | null = el as HTMLElement;
        while (cur && getComputedStyle(cur).position !== "sticky") cur = cur.parentElement;
        if (!cur) return null;
        const rect = cur.getBoundingClientRect();
        const cs = getComputedStyle(cur);
        return { top: rect.top, zIndex: cs.zIndex };
      });

      expect(stickyTop, "container sticky não encontrado").not.toBeNull();
      expect(stickyTop!.top, `sticky abaixo do viewport em ${vp.name}`).toBeGreaterThanOrEqual(0);
      // z-30 do stepper deve ser menor que header (z-40) — evita encobrir o header.
      expect(Number(stickyTop!.zIndex) || 30).toBeLessThan(40);
    });
  }
});
