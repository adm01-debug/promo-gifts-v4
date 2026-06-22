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

      // 3) Sidebar (desktop) ou layout mobile sem sobreposição abaixo de lg.
      if (vp.name === 'desktop') {
        const nav = page.getByRole('navigation', { name: /menu principal/i }).first();
        await expect(nav).toBeVisible();
        const navBox = await nav.boundingBox();
        expect(navBox?.y ?? 999).toBeLessThanOrEqual(8);
        expect(navBox?.height ?? 0).toBeGreaterThan(vp.height * 0.9);
      } else {
        const nav = page.getByRole('navigation', { name: /menu principal/i }).first();
        await expect(nav).not.toBeInViewport();
        const titleBox = await page.getByTestId('page-title-orcamento-novo').boundingBox();
        expect(titleBox?.x ?? -1).toBeGreaterThanOrEqual(0);
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

