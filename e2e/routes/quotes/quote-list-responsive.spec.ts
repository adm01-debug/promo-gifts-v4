/**
 * Lista de orçamentos — layout responsivo + regressão visual.
 *
 * Cobre 4 frentes:
 *  1) SSOT em sync (helper vs src/lib/quotes/quotesLayout.ts)
 *  2) Container preenche o viewport sem áreas vazias significativas
 *  3) Conteúdo (linhas) ≥ altura do container OU sentinel ausente
 *     (detecta gap "fantasma" onde o container é grande mas vazio)
 *  4) Snapshots visuais do container e do rodapé por viewport
 *
 * Política de seletores: somente Sel.* (TID).
 */
import { test, expect, requireAuth } from "../../fixtures/test-base";
import { gotoAndSettle } from "../../helpers/nav";
import { Sel } from "../../fixtures/selectors";
import {
  QUOTES_ROW_H,
  QUOTES_MIN_VISIBLE_ROWS,
  chromeHeight,
  containerMaxHeight,
  assertMirrorInSyncWithSSOT,
} from "../../helpers/quotes-layout";

type Vp = { name: "mobile" | "tablet" | "desktop"; w: number; h: number };
const VIEWPORTS: Vp[] = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 834, h: 1112 },
  { name: "desktop", w: 1440, h: 900 },
];
const MAX_BOTTOM_GAP = 64; // px tolerados entre container e rodapé/viewport
const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02, animations: "disabled" as const };

test.describe("Lista de orçamentos — responsivo + regressão visual", () => {
  test.beforeEach(() => requireAuth());

  test("mirror E2E está em sync com o SSOT de layout", () => {
    expect(() => assertMirrorInSyncWithSSOT()).not.toThrow();
  });

  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.w}x${vp.h}): container sem áreas vazias + snapshot`, async ({ page }) => {
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

      // (1) altura entre piso e teto calculados pelo SSOT
      const expected = containerMaxHeight(vp.w, vp.h);
      expect(box.height).toBeGreaterThanOrEqual(QUOTES_MIN_VISIBLE_ROWS * QUOTES_ROW_H - 1);
      expect(
        Math.abs(box.height - expected),
        `altura container vs SSOT(${expected}px) divergiu em ${vp.name}`,
      ).toBeLessThanOrEqual(2);

      // (2) gap container→rodapé pequeno
      const footer = page.locator(Sel.quotesList.footerCount);
      const footerBox = (await footer.count()) > 0 ? await footer.boundingBox() : null;
      const bottomRef = footerBox ? footerBox.y : vp.h;
      const gap = bottomRef - (box.y + box.height);
      expect(
        gap,
        `gap container→rodapé deveria ser ≤ ${MAX_BOTTOM_GAP}px em ${vp.name} (foi ${gap}px)`,
      ).toBeLessThanOrEqual(MAX_BOTTOM_GAP);

      // (3) chrome consumido bate com o SSOT por breakpoint
      expect(chromeHeight(vp.w)).toBeGreaterThan(0);

      // (4) Detecção de área vazia DENTRO do container:
      // conteúdo (scrollHeight) deve preencher o container OU sentinel deve
      // estar ausente (lista terminou). scrollHeight < clientHeight ∧ sentinel
      // presente == container grande demais com pouco conteúdo.
      const metrics = await container.evaluate((el) => ({
        scrollH: (el as HTMLElement).scrollHeight,
        clientH: (el as HTMLElement).clientHeight,
      }));
      const sentinelCount = await page.locator(Sel.quotesList.infiniteSentinel).count();
      const isEmptyState = (await page.locator(Sel.quotesList.emptyState).count()) > 0;
      if (!isEmptyState) {
        const hasGapInside = metrics.scrollH < metrics.clientH - 8 && sentinelCount > 0;
        expect(
          hasGapInside,
          `área vazia detectada em ${vp.name}: scrollH=${metrics.scrollH} < clientH=${metrics.clientH} com sentinel presente`,
        ).toBe(false);
      }

      // (5) SSOT --quotes-row-h disponível
      const rowVar = await container.evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--quotes-row-h").trim(),
      );
      expect(rowVar).toBe(`${QUOTES_ROW_H}px`);

      // (6) Snapshots visuais (baseline gerado no 1º run / `--update-snapshots`).
      await expect(container).toHaveScreenshot(
        `quotes-container-${vp.name}.png`,
        SNAPSHOT_OPTS,
      );
      if (footerBox) {
        await expect(footer).toHaveScreenshot(
          `quotes-footer-${vp.name}.png`,
          SNAPSHOT_OPTS,
        );
      }
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
