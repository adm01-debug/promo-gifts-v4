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

// Limites globais de jank (ajustáveis via env). Por viewport: viewports
// menores costumam ter menos frames disponíveis no headless; aceitamos um
// piso menor neles para reduzir flakiness sem mascarar regressões reais.
const MAX_SCROLL_MS = Number(process.env.STOCK_STICKY_MAX_MS ?? 250);
const MIN_FRAMES = Number(process.env.STOCK_STICKY_MIN_FRAMES ?? 3);
const JANK_BUDGET: Record<string, { maxMs: number; minFrames: number }> = {
  "mobile-sm": { maxMs: 320, minFrames: 2 },
  mobile: { maxMs: 300, minFrames: 2 },
  "mobile-tall": { maxMs: 280, minFrames: 3 },
  tablet: { maxMs: 260, minFrames: 3 },
  "tablet-short": { maxMs: 260, minFrames: 3 },
  "laptop-short": { maxMs: 250, minFrames: 3 },
  desktop: { maxMs: 240, minFrames: 3 },
  "desktop-fhd": { maxMs: 220, minFrames: 4 },
  "desktop-tall": { maxMs: 220, minFrames: 4 },
};

// Trilha estruturada — facilita diagnóstico de falhas intermitentes
// (fontes não prontas, skeleton persistente, scrollHeight oscilante, etc.).
function trail(vp: string, step: string, data: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.log(`[stock-sticky:${vp}] ${step} ${JSON.stringify(data)}`);
}

async function waitForFontsAndRows(page: Page, vp: string) {
  const fontsT0 = Date.now();
  await page.evaluate(async () => {
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts?.ready) await fonts.ready;
  });
  trail(vp, "fonts.ready", { ms: Date.now() - fontsT0 });

  const skeletonGone = await page
    .locator('[data-testid="variant-stock-skeleton"]')
    .first()
    .waitFor({ state: "detached", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  trail(vp, "skeleton.gone", { ok: skeletonGone });

  await expect(page.locator(`${SCROLL} tbody tr`).first()).toBeVisible({ timeout: 30_000 });
  const rowCount = await page.locator(`${SCROLL} tbody tr`).count();
  trail(vp, "rows.ready", { count: rowCount });

  const heightSeries = await page.locator(SCROLL).evaluate(async (el) => {
    const series: number[] = [];
    let last = -1;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const h = el.scrollHeight;
      series.push(h);
      if (h === last && h > 0) break;
      last = h;
    }
    return series;
  });
  trail(vp, "scrollHeight.stable", {
    final: heightSeries[heightSeries.length - 1],
    samples: heightSeries.length,
  });
}

test.describe("@regression /estoque — tabela sticky (toolbar + thead)", () => {
  // Retry controlado por spec (independe do default do projeto) — captura
  // flakiness sem mascarar regressão real (logs por tentativa + traces).
  test.describe.configure({ retries: 2 });

  for (const vp of viewports) {
    test(`@stock-table-sticky permanece fixo no scroll — ${vp.name}`, async ({ page }, testInfo) => {
      trail(vp.name, "test.start", { attempt: testInfo.retry, viewport: vp });
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

      await waitForFontsAndRows(page, vp.name);

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
      trail(vp.name, "scroll.metrics", metrics);

      if (metrics.scrolled <= 0) {
        test.skip(true, "conteúdo não excede a altura interna — sem scroll a validar");
        return;
      }

      const budget = JANK_BUDGET[vp.name] ?? { maxMs: MAX_SCROLL_MS, minFrames: MIN_FRAMES };
      expect(
        metrics.ms,
        `scroll demorou ${metrics.ms.toFixed(1)}ms (>${budget.maxMs}ms) em ${vp.name}`,
      ).toBeLessThanOrEqual(budget.maxMs);
      expect(
        metrics.frames,
        `apenas ${metrics.frames} frames durante o scroll em ${vp.name} (mín ${budget.minFrames}) — possível jank`,
      ).toBeGreaterThanOrEqual(budget.minFrames);

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
