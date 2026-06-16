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
const HEADER = TID("app-header");
const BREADCRUMB = TID("breadcrumb-bar");
const SCROLL_DELTA = 400;

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

// Limites de jank (ajustáveis via env p/ CI lento)
const MAX_SCROLL_MS = Number(process.env.STOCK_STICKY_MAX_MS ?? 250);
const MIN_FRAMES = Number(process.env.STOCK_STICKY_MIN_FRAMES ?? 3);

async function waitForFontsAndRows(page: Page) {
  // 1) Fontes prontas (evita reflow que altera boundingBox depois da medição)
  await page.evaluate(async () => {
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) await fonts.ready;
  });
  // 2) Pelo menos uma linha de dados renderizada (não skeleton)
  await expect(page.locator(`${SCROLL} tbody tr`).first()).toBeVisible({ timeout: 30_000 });
  // 3) scrollHeight da página estabilizado antes de medir sticky/boundingBox
  await page.evaluate(async () => {
    const stable = async () => {
      let last = document.documentElement.scrollHeight;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (document.documentElement.scrollHeight === last && last > 0) return;
        last = document.documentElement.scrollHeight;
      }
    };
    await stable();
  });
}

async function waitForAnimationFrames(page: Page, frames = 4) {
  await page.evaluate(async (frameCount) => {
    for (let i = 0; i < frameCount; i++) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
  }, frames);
}

async function getStickyOffset(page: Page) {
  return page.evaluate(({ headerSelector, breadcrumbSelector }) => {
    const rectHeight = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return 0;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || el.getAttribute("aria-hidden") === "true") {
        return 0;
      }
      return el.getBoundingClientRect().height;
    };

    const cssPx = (name: string, fallback: number) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return Math.max(rectHeight(headerSelector), cssPx("--header-h", 56)) + rectHeight(breadcrumbSelector);
  }, { headerSelector: HEADER, breadcrumbSelector: BREADCRUMB });
}

async function pinToolbarForMeasurement(page: Page) {
  await page.locator(TOOLBAR).evaluate((el) => {
    const cssPx = (name: string, fallback: number) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const breadcrumb = document.querySelector('[data-testid="breadcrumb-bar"]');
    const breadcrumbVisible =
      breadcrumb &&
      breadcrumb.getAttribute("aria-hidden") !== "true" &&
      getComputedStyle(breadcrumb).display !== "none";
    const stickyTop = cssPx("--header-h", 56) + (breadcrumbVisible ? breadcrumb.getBoundingClientRect().height : 0);
    const target = window.scrollY + el.getBoundingClientRect().top - stickyTop - 8;
    window.scrollTo({ top: Math.max(0, target), behavior: "auto" });
  });
  await waitForAnimationFrames(page);
}

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

      // Esperas explícitas: fontes + dados + scrollHeight estável
      await waitForFontsAndRows(page);

      const fontBefore = await thead.evaluate(
        (el) => getComputedStyle(el.querySelector("th") ?? el).fontSize,
      );

      const toolbarBefore = await toolbar.boundingBox();
      const theadBefore = await thead.boundingBox();
      if (!toolbarBefore || !theadBefore) {
        test.skip(true, "bounding boxes indisponíveis");
        return;
      }

      // Visual regression before/after em memória: evita depender de baselines
      // PNG ausentes na primeira execução da pipeline e ainda detecta mudança
      // visual na toolbar/thead após o scroll interno.
      const toolbarBeforePng = await toolbar.screenshot({ animations: "disabled" });
      const theadBeforePng = await thead.screenshot({ animations: "disabled" });

      // Métrica: tempo de scroll + nº de frames (proxy de fluidez)
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
        el.scrollTo({ top: Math.min(maxScroll, 400), behavior: "auto" });
        await new Promise((r) => setTimeout(r, 200));
        cancelAnimationFrame(handle);
        return { scrolled: el.scrollTop, ms: performance.now() - t0, frames, maxScroll };
      });
      // eslint-disable-next-line no-console
      console.log(`[stock-sticky:${vp.name}] metrics=${JSON.stringify(metrics)}`);

      if (metrics.scrolled <= 0) {
        test.skip(true, "conteúdo não excede a altura interna — sem scroll a validar");
        return;
      }

      // Asserções de jank: tempo total e mínimo de frames durante a janela
      expect(
        metrics.ms,
        `scroll demorou ${metrics.ms.toFixed(1)}ms (>${MAX_SCROLL_MS}ms) em ${vp.name}`,
      ).toBeLessThanOrEqual(MAX_SCROLL_MS);
      expect(
        metrics.frames,
        `apenas ${metrics.frames} frames durante o scroll em ${vp.name} (mín ${MIN_FRAMES}) — possível jank`,
      ).toBeGreaterThanOrEqual(MIN_FRAMES);

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

      // Tipografia inalterada após o scroll
      const fontAfter = await thead.evaluate(
        (el) => getComputedStyle(el.querySelector("th") ?? el).fontSize,
      );
      expect(fontAfter).toBe(fontBefore);

      // Visual regression — depois do scroll deve permanecer idêntico ao antes.
      const toolbarAfterPng = await toolbar.screenshot({ animations: "disabled" });
      const theadAfterPng = await thead.screenshot({ animations: "disabled" });
      expect(toolbarAfterPng.equals(toolbarBeforePng), `toolbar mudou visualmente após scroll em ${vp.name}`).toBe(true);
      expect(theadAfterPng.equals(theadBeforePng), `thead mudou visualmente após scroll em ${vp.name}`).toBe(true);

      // Conteúdo da última linha visível NÃO pode estar cortado pelo container
      const scrollRect = await scroll.boundingBox();
      const lastRow = page.locator(`${SCROLL} tbody tr`).last();
      if (await lastRow.isVisible().catch(() => false)) {
        const rowBox = await lastRow.boundingBox();
        if (rowBox && scrollRect) {
          expect(rowBox.y + rowBox.height).toBeGreaterThan(scrollRect.y);
          expect(rowBox.y).toBeLessThan(scrollRect.y + scrollRect.height);
        }
      }
    });
  }
});
