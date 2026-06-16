/**
 * Stock table sticky — valida que ao rolar a tabela "Estoque por Cor/Variação":
 *   - a toolbar (busca + paginação + Expandir/Recolher) permanece visível
 *   - o cabeçalho `<thead>` permanece visível
 *   - o conteúdo das linhas não fica cortado em mobile (375), tablet (820) e
 *     desktop (1366)
 *
 * Skipa automaticamente se a rota estiver vazia/em sincronização — preserva
 * o CI em ambientes sem dados seedados.
 */
import { test, expect, type Page } from "../../fixtures/test-base";
import { TID } from "../../fixtures/selectors";
import { gotoAndSettle } from "../../helpers/nav";
import { loginAs } from "../../helpers/auth";

const TOOLBAR = TID("variant-stock-toolbar");
const THEAD = TID("variant-stock-thead");
const SCROLL = TID("variant-stock-scroll");

async function maybeSkipIfEmpty(page: Page) {
  const syncing = page.getByText(/Sincronizando estoque/i);
  if (await syncing.isVisible().catch(() => false)) {
    await expect(syncing).not.toBeVisible({ timeout: 60_000 });
  }
  const empty = page.getByText(/Nenhum produto encontrado/i);
  if (await empty.isVisible().catch(() => false)) {
    test.skip(true, "sem dados seedados para validar sticky");
  }
}

const viewports = [
  { name: "mobile-sm", width: 360, height: 640 },
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile-tall", width: 414, height: 896 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "tablet-short", width: 1024, height: 768 },
  { name: "laptop-short", width: 1366, height: 700 },
  { name: "desktop", width: 1366, height: 900 },
  { name: "desktop-fhd", width: 1920, height: 1080 },
  { name: "desktop-tall", width: 1536, height: 1440 },
] as const;

test.describe("@regression /estoque — tabela sticky (toolbar + thead)", () => {
  for (const vp of viewports) {
    test(`@stock-table-sticky permanece fixo no scroll — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await loginAs(page, "admin");
      await gotoAndSettle(page, "/estoque");
      await maybeSkipIfEmpty(page);

      const toolbar = page.locator(TOOLBAR);
      const thead = page.locator(THEAD);
      const scroll = page.locator(SCROLL);

      await expect(toolbar).toBeVisible();
      await expect(thead).toBeVisible();
      await expect(scroll).toBeVisible();

      // Snapshot do tamanho de fonte do thead para garantir que o redimensionamento
      // do container NÃO alterou tipografia (regressão de "diminuir/aumentar textos")
      const fontBefore = await thead.evaluate(
        (el) => getComputedStyle(el.querySelector("th") ?? el).fontSize,
      );

      const toolbarBefore = await toolbar.boundingBox();
      const theadBefore = await thead.boundingBox();
      if (!toolbarBefore || !theadBefore) {
        test.skip(true, "bounding boxes indisponíveis");
        return;
      }

      // Métrica: tempo de scroll programático + nº de frames (proxy de fluidez)
      const metrics = await scroll.evaluate(async (el) => {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) return { scrolled: 0, ms: 0, frames: 0, maxScroll };
        let frames = 0;
        const rafTick = () => {
          frames++;
          handle = requestAnimationFrame(rafTick);
        };
        let handle = requestAnimationFrame(rafTick);
        const t0 = performance.now();
        const target = Math.min(maxScroll, 400);
        el.scrollTo({ top: target, behavior: "auto" });
        await new Promise((r) => setTimeout(r, 120));
        cancelAnimationFrame(handle);
        return { scrolled: el.scrollTop, ms: performance.now() - t0, frames, maxScroll };
      });
      // Log estruturado p/ a aba "test results"
      // eslint-disable-next-line no-console
      console.log(`[stock-sticky:${vp.name}] metrics=${JSON.stringify(metrics)}`);

      if (metrics.scrolled <= 0) {
        test.skip(true, "conteúdo não excede a altura interna — sem scroll a validar");
        return;
      }

      await expect(toolbar).toBeVisible();
      await expect(thead).toBeVisible();
      const toolbarAfter = await toolbar.boundingBox();
      const theadAfter = await thead.boundingBox();
      expect(toolbarAfter).not.toBeNull();
      expect(theadAfter).not.toBeNull();

      expect(Math.abs((toolbarAfter!.y ?? 0) - toolbarBefore.y)).toBeLessThanOrEqual(2);
      expect(Math.abs((theadAfter!.y ?? 0) - theadBefore.y)).toBeLessThanOrEqual(2);

      expect((theadAfter!.y ?? 0)).toBeGreaterThanOrEqual(
        toolbarAfter!.y + Math.min(toolbarAfter!.height, 16),
      );

      // Tipografia inalterada após o scroll/resize
      const fontAfter = await thead.evaluate(
        (el) => getComputedStyle(el.querySelector("th") ?? el).fontSize,
      );
      expect(fontAfter).toBe(fontBefore);

      // Conteúdo da última linha visível NÃO pode estar cortado pelo container
      const scrollRect = await scroll.boundingBox();
      const lastRow = page.locator(`${SCROLL} tbody tr`).last();
      if (await lastRow.isVisible().catch(() => false)) {
        const rowBox = await lastRow.boundingBox();
        if (rowBox && scrollRect) {
          // pelo menos parte da linha precisa estar dentro da janela do container
          expect(rowBox.y + rowBox.height).toBeGreaterThan(scrollRect.y);
          expect(rowBox.y).toBeLessThan(scrollRect.y + scrollRect.height);
        }
      }
    });
  }
});
