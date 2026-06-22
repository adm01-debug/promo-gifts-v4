/**
 * Baseline visual do <ColorSwatchPicker size="sm" maxVisible={4} /> com
 * a flag `useColorSwatchesV2` LIGADA, nas 4 rotas que consomem o pipeline V2:
 *
 *   - /produtos   (Catálogo)
 *   - /filtros    (Super Filtro)
 *   - /novidades  (Novidades)
 *   - /reposicao  (Reposição)
 *
 * Objetivo: detectar regressões visuais (cores, layout, spacing, overflow "+N",
 * botão "Todos", ring de ativo) sem precisar abrir QuickView.
 *
 * Estratégia:
 *   1. Liga a flag via `ff_useColorSwatchesV2=true` (chave canônica lida por
 *      `isFeatureEnabled()` em DEV — ver src/lib/feature-flags.ts).
 *   2. Navega para a rota, espera o primeiro card com swatches V2 aparecer
 *      (V2 NÃO usa role="radio", e sim aria-pressed em <button>).
 *   3. Desativa animações para snapshots determinísticos.
 *   4. Tira screenshot recortado no primeiro picker (estado inicial =
 *      "Todas as cores") e um segundo clicando no 2º swatch (estado ativo
 *      mostrando o botão "Todos" + ring no swatch selecionado).
 *
 * Os snapshots são gerados/atualizados pelo workflow visual-tests.yml
 * (`--update-snapshots`). Em PRs subsequentes, qualquer diff visual quebra
 * o gate.
 */

import { test, expect, type Page } from '@playwright/test';

const ROUTES = [
  { slug: 'catalogo',     path: '/produtos'  },
  { slug: 'super-filtro', path: '/filtros'   },
  { slug: 'novidades',    path: '/novidades' },
  { slug: 'reposicao',    path: '/reposicao' },
] as const;

// V2 picker: <button aria-pressed> com cor de fundo inline.
// Distinguimos de V1 (que usa role="radio") via :not([role="radio"]).
const V2_PICKER_BUTTON =
  'button[aria-pressed][title]:not([role="radio"])[style*="background-color"]';

async function enableV2(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('ff_useColorSwatchesV2', 'true');
    } catch {/* ignore */}
  });
}

async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0ms !important;
        transition-delay: 0ms !important;
      }
    `,
  });
}

for (const route of ROUTES) {
  test.describe(`Visual baseline • V2 ColorSwatchPicker • ${route.slug}`, () => {
    test(`${route.slug}: picker sm/maxVisible=4 renderiza consistente`, async ({ page }) => {
      await enableV2(page);
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // Espera pelo menos um picker V2 montado (até 20s — rotas com dados externos).
      const firstSwatch = page.locator(V2_PICKER_BUTTON).first();
      const appeared = await firstSwatch.waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

      test.skip(!appeared, `Sem produtos com color_swatches em ${route.path} (ambiente sem dados V2).`);

      await freezeAnimations(page);

      // Container pai do picker (flex wrap) — alvo do recorte.
      const pickerContainer = firstSwatch.locator(
        'xpath=ancestor::div[contains(@class,"flex")][contains(@class,"flex-wrap")][1]'
      );
      await expect(pickerContainer).toBeVisible();

      // Garante que o picker está no viewport antes de medir.
      await pickerContainer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150); // estabilização pós-scroll

      // Estado 1 — sem seleção (sem botão "Todos").
      await expect(pickerContainer).toHaveScreenshot(
        `v2-picker-${route.slug}-idle.png`,
        { maxDiffPixelRatio: 0.02, animations: 'disabled' }
      );

      // Estado 2 — com seleção ativa: clica no 2º swatch (se existir) para
      // expor o botão "Todos" + ring de ativo.
      const swatches = pickerContainer.locator(V2_PICKER_BUTTON);
      const count = await swatches.count();
      if (count >= 2) {
        await swatches.nth(1).click();
        await page.waitForTimeout(120);
        await expect(pickerContainer).toHaveScreenshot(
          `v2-picker-${route.slug}-active.png`,
          { maxDiffPixelRatio: 0.02, animations: 'disabled' }
        );
      }
    });
  });
}
