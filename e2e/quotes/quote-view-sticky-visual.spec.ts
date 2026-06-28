/**
 * Visual regression — sidebar fixa antes/depois do scroll.
 *
 * Estabilidade no CI:
 *  - viewport fixo 1280×900 + DPR padrão do project
 *  - `reducedMotion: 'reduce'` no contexto + `animations: 'disabled'` no snapshot
 *  - aguardar `data-scroll-at-top|bottom` para evitar capturar mid-scroll
 *  - mascarar regiões com conteúdo dinâmico (datas, valores) que mudam por seed
 *  - tolerância calibrada: `maxDiffPixelRatio: 0.02`, `threshold: 0.2`
 *
 * Para atualizar baselines (uma vez por project):
 *   npx playwright test e2e/quotes/quote-view-sticky-visual.spec.ts \
 *     --project=chromium-public --update-snapshots
 *   (repetir para firefox-public e webkit-public)
 */
import { test, expect } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';

test.use({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});

const SNAPSHOT_OPTS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
  scale: 'css' as const,
};

test.describe('@visual sidebar sticky', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAndSettle(page, ROUTE);
    await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
    // Garante que fontes/imagens da sidebar estabilizaram antes do snapshot.
    await page.evaluate(() => document.fonts && (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
  });

  test('sidebar antes do scroll', async ({ page }) => {
    const aside = page.locator('aside').first();
    await expect(aside).toBeVisible();
    // Confirma topo de página estável.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => window.scrollY === 0);
    await expect(aside).toHaveScreenshot('sidebar-before-scroll.png', SNAPSHOT_OPTS);
  });

  test('sidebar depois do scroll até "Versões do Orçamento"', async ({ page }) => {
    const aside = page.locator('aside').first();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Estado estável: parou no fim do documento.
    await page.waitForFunction(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.abs(window.scrollY - max) <= 2;
    });
    await expect(page.getByTestId('harness-quote-versions')).toBeInViewport();
    await expect(aside).toHaveScreenshot('sidebar-after-scroll.png', SNAPSHOT_OPTS);
  });
});
