/**
 * Baseline visual do <ColorSwatchPicker> V2 (size="sm" maxVisible={4}) nas
 * 4 rotas que consomem o pipeline: /produtos, /filtros, /novidades, /reposicao.
 *
 * Cobertura:
 *   • snapshot do estado idle  (sem cor ativa)
 *   • snapshot do estado ativo (segunda cor selecionada → expõe botão "Todos"
 *     + ring no swatch ativo)
 *
 * Determinismo:
 *   • flag `ff_useColorSwatchesV2=true` via addInitScript (mesma chave lida
 *     por isFeatureEnabled em src/lib/feature-flags.ts)
 *   • animações/transições zeradas via FREEZE_CSS
 *   • caret transparente para evitar flicker
 *
 * Tolerância: maxDiffPixelRatio 0.02 (≤2% de pixels diferentes por snapshot).
 *
 * Skip automático quando a rota não tem produtos com swatches V2 (evita
 * falso-positivo em ambientes com seed mínimo).
 */

import { test, expect, type Page } from '@playwright/test';

const ROUTES = [
  { slug: 'catalogo',     path: '/produtos'  },
  { slug: 'super-filtro', path: '/filtros'   },
  { slug: 'novidades',    path: '/novidades' },
  { slug: 'reposicao',    path: '/reposicao' },
] as const;

const V2_SWATCH =
  'button[aria-pressed][title]:not([role="radio"])[style*="background-color"]';

const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
  *:focus { caret-color: transparent !important; }
`;

async function bootstrap(page: Page, path: string) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('ff_useColorSwatchesV2', 'true'); } catch {/* ignore */}
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: FREEZE_CSS });
}

for (const route of ROUTES) {
  test.describe(`ColorSwatchPicker V2 — baseline ${route.slug}`, () => {
    test(`v2-picker-${route.slug} (idle + active)`, async ({ page }) => {
      await bootstrap(page, route.path);

      const firstSwatch = page.locator(V2_SWATCH).first();
      const hasV2 = await firstSwatch
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

      test.skip(!hasV2, `Sem produtos V2 em ${route.path} — baseline ignorado`);

      // Container do picker (ancestral mais próximo com flex flex-wrap).
      const picker = firstSwatch.locator(
        'xpath=ancestor::div[contains(@class,"flex")][contains(@class,"flex-wrap")][1]'
      );

      await picker.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150); // pequena estabilização pós-scroll
      await expect(picker).toHaveScreenshot(`v2-picker-${route.slug}-idle.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      // Estado ativo: clica no 2º swatch (se existir) para expor "Todos" + ring.
      const swatchCount = await picker.locator(V2_SWATCH).count();
      const targetIndex = swatchCount >= 2 ? 1 : 0;
      await picker.locator(V2_SWATCH).nth(targetIndex).click();
      await page.waitForTimeout(150);

      await expect(picker).toHaveScreenshot(`v2-picker-${route.slug}-active.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}
