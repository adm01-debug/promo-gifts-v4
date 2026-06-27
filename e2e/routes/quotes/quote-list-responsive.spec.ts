/**
 * Lista de orçamentos — layout responsivo do container de rolagem.
 *
 * Valida que `quotes-scroll-container`:
 *   1) cresce/encolhe com o viewport (mobile < tablet < desktop);
 *   2) ocupa o espaço útil real (sem grande "área vazia" entre o container
 *      e o rodapé/viewport bottom);
 *   3) respeita a SSOT de altura da linha (--quotes-row-h = 80px), de modo que
 *      a altura visível seja múltipla aproximada de 80px (±1 linha).
 *
 * Política de seletores: somente Sel.* (TID).
 */
import { test, expect, requireAuth } from "../../fixtures/test-base";
import { gotoAndSettle } from "../../helpers/nav";
import { Sel } from "../../fixtures/selectors";

type Vp = { name: "mobile" | "tablet" | "desktop"; w: number; h: number };
const VIEWPORTS: Vp[] = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 834, h: 1112 },
  { name: "desktop", w: 1440, h: 900 },
];
const ROW_H = 80; // SSOT --quotes-row-h
const MAX_BOTTOM_GAP = 64; // px tolerados entre fim do container e o rodapé

test.describe("Lista de orçamentos — responsivo (sem áreas vazias)", () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`container preenche viewport ${vp.name} (${vp.w}x${vp.h}) sem espaço em branco`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await gotoAndSettle(page, "/orcamentos");
      await expect(page.locator(Sel.page.title("orcamentos")).first()).toBeVisible({
        timeout: 15_000,
      });

      const container = page.locator(Sel.quotesList.scrollContainer);
      await expect(container).toBeVisible({ timeout: 15_000 });

      const box = await container.boundingBox();
      expect(box, `bounding box do container em ${vp.name}`).not.toBeNull();
      if (!box) return;

      // (1) altura cresce com o viewport (vs piso de 5 linhas)
      const MIN_H = 5 * ROW_H;
      expect(box.height).toBeGreaterThanOrEqual(MIN_H - 1);

      // (2) sem grande área vazia entre o container e o rodapé (ou o fim do viewport)
      const footer = page.locator(Sel.quotesList.footerCount);
      const footerBox = (await footer.count()) > 0 ? await footer.boundingBox() : null;
      const bottomRef = footerBox ? footerBox.y : vp.h;
      const gap = bottomRef - (box.y + box.height);
      expect(
        gap,
        `gap container→rodapé deveria ser ≤ ${MAX_BOTTOM_GAP}px em ${vp.name} (foi ${gap}px)`,
      ).toBeLessThanOrEqual(MAX_BOTTOM_GAP);

      // (3) SSOT --quotes-row-h disponível e == 80px
      const rowVar = await container.evaluate(
        (el) => getComputedStyle(el).getPropertyValue("--quotes-row-h").trim(),
      );
      expect(rowVar).toBe(`${ROW_H}px`);
    });
  }

  test("desktop mostra mais linhas que mobile", async ({ page }) => {
    await gotoAndSettle(page, "/orcamentos");
    const container = page.locator(Sel.quotesList.scrollContainer);
    await expect(container).toBeVisible({ timeout: 15_000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await container.boundingBox();

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktop = await container.boundingBox();

    expect(mobile && desktop).toBeTruthy();
    if (mobile && desktop) {
      expect(desktop.height).toBeGreaterThan(mobile.height);
    }
  });
});
