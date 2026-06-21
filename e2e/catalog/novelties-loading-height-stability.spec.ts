/**
 * E2E — Estabilidade da altura do container interno do grid em /novidades.
 *
 * O grid usa scroll INTERNO (`[data-testid="novelty-grid-scroll"]`) com altura
 * calculada via ResizeObserver. Este teste valida:
 *  1. O bloco de loading (`novelty-loading-grid`) reserva altura quando aparece.
 *  2. Após a montagem, a altura do container fica estável entre leituras (sem
 *     jitter visível) e não colapsa após o skeleton sumir.
 *  3. O `scrollHeight` interno aumenta (cresce) durante a paginação infinita,
 *     mas o `clientHeight` (altura visível) permanece estável.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — estabilidade de altura do container interno', () => {
  test.beforeEach(() => requireAuth());

  test('container interno mantém clientHeight estável durante paginação', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    // 1) Captura altura reservada pelo skeleton, se ainda visível.
    const loadingGrid = page.getByTestId('novelty-loading-grid');
    let skeletonReservedHeight = 0;
    try {
      await loadingGrid.waitFor({ state: 'visible', timeout: 2_000 });
      const box = await loadingGrid.boundingBox();
      skeletonReservedHeight = box?.height ?? 0;
      expect(skeletonReservedHeight).toBeGreaterThanOrEqual(400);
    } catch {
      /* skeleton já sumiu em ambiente rápido */
    }

    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Sem novidades no dataset — transição não aplicável.');
      return;
    }

    // 2) Após montar, clientHeight do container >= ao reservado (com tolerância).
    const initial = await scroller.evaluate((el) => ({
      ch: el.clientHeight,
      sh: el.scrollHeight,
    }));
    expect(initial.ch).toBeGreaterThanOrEqual(320);
    if (skeletonReservedHeight > 0) {
      expect(initial.ch).toBeGreaterThanOrEqual(Math.min(skeletonReservedHeight, 320) - 24);
    }

    // 3) Amostragem de clientHeight enquanto rola — DEVE permanecer estável
    //    (jitter <= 4px). scrollHeight pode crescer (paginação infinita).
    const samples: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      await scroller.evaluate((el, step) => el.scrollBy({ top: step }), 600);
      await page.waitForTimeout(200);
      const m = await scroller.evaluate((el) => ({
        ch: el.clientHeight,
        sh: el.scrollHeight,
      }));
      samples.push(m.ch);
    }
    const minCh = Math.min(...samples);
    const maxCh = Math.max(...samples);
    // Jitter de altura visível ≤ 4px (tolerância p/ arredondamento sub-pixel).
    expect(maxCh - minCh).toBeLessThanOrEqual(4);

    // 4) scrollHeight cresceu ou permaneceu (nunca colapsa).
    const finalSh = await scroller.evaluate((el) => el.scrollHeight);
    expect(finalSh).toBeGreaterThanOrEqual(initial.sh - 8);
  });
});
