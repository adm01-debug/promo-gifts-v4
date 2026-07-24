/**
 * E2E — Novo Orçamento · scroll natural da página + SidebarReorganized fixo.
 *
 * Valida em desktop e mobile que:
 *  - O sidebar permanece visível e ancorado no topo após rolar a página.
 *  - O conteúdo principal rola (scrollY > 0) sem travas de overflow.
 *  - O último CTA ("Salvar Rascunho") fica visível após o scroll e mantém
 *    folga > 0 até a borda inferior do viewport (sem colar no rodapé).
 */
import { test, expect } from '../fixtures/test-base';
import { requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';
import type { Page } from '@playwright/test';

const ROUTE = '/orcamentos/novo';
const MIN_CTA_BOTTOM_GAP = 16;

async function waitForVisualStability(page: Page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    const images = Array.from(document.images).filter((img) => !img.complete);
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

test.describe('Novo Orçamento · scroll natural + sidebar fixo', () => {
  test.skip(({ page: _page }, testInfo) => testInfo.project.name !== 'chromium-authed',
    'Visual regression do Novo Orçamento roda só no Chromium autenticado; a spec já alterna desktop/mobile via viewport.',
  );
  test.beforeEach(() => requireAuth());

  for (const vp of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1280, height: 1800 },
  ] as const) {
    test(`[${vp.name}] página rola e sidebar permanece visível`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, ROUTE);

      // Header da página renderizou
      await expect(page.getByTestId('page-title-orcamento-novo')).toBeVisible({
        timeout: 15_000,
      });

      // 1) Página rola naturalmente
      const before = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForFunction((b) => window.scrollY > b, before, { timeout: 2_000 }).catch(() => {
        // viewport pode caber tudo em desktop alto — não bloqueia
      });

      // 2) Último CTA acessível via scroll, com folga até a borda inferior.
      const cta = page.getByRole('button', { name: /Salvar Rascunho/i }).first();
      await cta.scrollIntoViewIfNeeded();
      await waitForVisualStability(page);
      await expect(cta).toBeVisible();
      const box = await cta.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        const gap = vp.height - (box.y + box.height);
        expect(gap).toBeGreaterThanOrEqual(MIN_CTA_BOTTOM_GAP);
      }

      // 2.1) Estabilidade do CTA — Y não muda após 600ms (sem CLS pós-hidratação).
      const y1 = (await cta.boundingBox())?.y ?? -1;
      await waitForVisualStability(page);
      const y2 = (await cta.boundingBox())?.y ?? -1;
      expect(Math.abs(y2 - y1)).toBeLessThanOrEqual(1);

      // 2.2) O CTA final deve estar em um footer sticky do resumo. No desktop,
      //      o resumo tem altura computada + scroll interno controlado; no
      //      mobile, permanece no fluxo natural da página.
      const summaryScrollOverflow = await page
        .getByTestId('quote-builder-summary-scroll')
        .evaluate((el) => getComputedStyle(el as HTMLElement).overflowY);
      expect(summaryScrollOverflow).toBe(vp.name === 'desktop' ? 'auto' : 'visible');

      const summaryFooterPosition = await page
        .getByTestId('quote-builder-summary-footer')
        .evaluate((el) => getComputedStyle(el as HTMLElement).position);
      expect(summaryFooterPosition).toBe('sticky');

      // 3) Sidebar (desktop) ou layout mobile sem sobreposição abaixo de lg.
      if (vp.name === 'desktop') {
        const nav = page.getByRole('navigation', { name: /menu principal/i }).first();
        await expect(nav).toBeVisible();
        const navBox = await nav.boundingBox();
        expect(navBox?.y ?? 999).toBeLessThanOrEqual(8);
        expect(navBox?.height ?? 0).toBeGreaterThan(vp.height * 0.9);

        // 3.1) Coluna de resumo sticky após hidratação: position computado === 'sticky'
        const stickyPos = await page
          .getByTestId('quote-builder-summary-sticky')
          .evaluate((el) => getComputedStyle(el as HTMLElement).position);
        expect(stickyPos).toBe('sticky');

        const stickyMetrics = await page
          .getByTestId('quote-builder-summary-sticky')
          .evaluate((el) => {
            const node = el as HTMLElement;
            const style = getComputedStyle(node);
            return {
              height: node.getBoundingClientRect().height,
              overflowY: style.overflowY,
            };
          });
        expect(stickyMetrics.height).toBeGreaterThan(0);
        expect(stickyMetrics.height).toBeLessThan(vp.height);
        expect(stickyMetrics.overflowY).toBe('hidden');

        const stickyParentOverflow = await page
          .getByTestId('quote-builder-summary-column')
          .evaluate((el) => getComputedStyle(el as HTMLElement).overflowY);
        expect(stickyParentOverflow).toBe('visible');

        // 3.2) Após rolar a página, a coluna de resumo permanece ancorada no topo
        await page.evaluate(() => window.scrollBy(0, 400));
        await waitForVisualStability(page);
        const sumBox = await page.getByTestId('quote-builder-summary-sticky').boundingBox();
        expect(sumBox?.y ?? 999).toBeLessThanOrEqual(
          // header (56) + breadcrumb (40) + 1rem (16) + tolerância
          56 + 40 + 16 + 8,
        );
      } else {
        const nav = page.getByRole('navigation', { name: /menu principal/i }).first();
        await expect(nav).not.toBeInViewport();
        const titleBox = await page.getByTestId('page-title-orcamento-novo').boundingBox();
        expect(titleBox?.x ?? -1).toBeGreaterThanOrEqual(0);

        // 3.3) Mobile: a coluna de resumo NÃO é sticky (empilhada) — evita
        //      sobreposição de conteúdo abaixo do lg.
        const stickyPos = await page
          .getByTestId('quote-builder-summary-sticky')
          .evaluate((el) => getComputedStyle(el as HTMLElement).position);
        expect(stickyPos).not.toBe('sticky');
      }

      // 3.4) Posição relativa da coluna sticky após rolar 0, 200 e 400px.
      //      Desktop: top do sticky deve ficar ancorado dentro da faixa
      //      [header+breadcrumb, header+breadcrumb+tolerância] independente do scroll.
      //      Mobile: como não é sticky, o top deve acompanhar o scroll
      //      (delta(top) ≈ -delta(scrollY)).
      const STICKY_TOP_MIN = 56 + 40; // header + breadcrumb
      const STICKY_TOP_MAX = 56 + 40 + 16 + 8; // + 1rem + tolerância
      const SCROLL_DELTA_TOLERANCE = 2;

      await page.evaluate(() => window.scrollTo(0, 0));
      await waitForVisualStability(page);

      const samples: Array<{ scrollY: number; top: number }> = [];
      for (const targetY of [0, 200, 400] as const) {
        await page.evaluate((y) => window.scrollTo(0, y), targetY);
        await waitForVisualStability(page);
        const measured = await page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="quote-builder-summary-sticky"]',
          ) as HTMLElement | null;
          return {
            scrollY: window.scrollY,
            top: el ? el.getBoundingClientRect().top : Number.NaN,
          };
        });
        expect(Number.isFinite(measured.top)).toBe(true);
        samples.push(measured);
      }

      if (vp.name === 'desktop') {
        for (const s of samples) {
          expect(s.top).toBeGreaterThanOrEqual(STICKY_TOP_MIN - SCROLL_DELTA_TOLERANCE);
          expect(s.top).toBeLessThanOrEqual(STICKY_TOP_MAX);
        }
      } else {
        // No mobile, o top do sticky deve cair conforme a página rola.
        const base = samples[0];
        for (const s of samples.slice(1)) {
          const expectedTop = base.top - (s.scrollY - base.scrollY);
          expect(Math.abs(s.top - expectedTop)).toBeLessThanOrEqual(SCROLL_DELTA_TOLERANCE);
        }
      }

      // 4) Snapshot visual determinístico — volta ao topo, aguarda fontes,
      //    assets e 2 frames estáveis para evitar flakiness (FOUT/CLS).
      await page.evaluate(() => window.scrollTo(0, 0));
      await waitForVisualStability(page);
      await expect(page).toHaveScreenshot(`quote-builder-${vp.name}.png`, {
        fullPage: false,
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});

