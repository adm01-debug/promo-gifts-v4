/**
 * E2E — Performance da virtualização de /novidades.
 *
 * Cobre simultaneamente:
 *  1. Os parâmetros do virtualizer estão expostos via data-attributes
 *     (`data-grid-overscan`, `data-grid-estimate-size`) e dentro de faixas sãs.
 *  2. A altura calculada via ResizeObserver (`data-grid-scroll-height`) bate
 *     com o `clientHeight` real do container (tolerância ≤ 2px) e permanece
 *     estável após carregamento de novos itens (sem saltos).
 *  3. O número de `role="listitem"` no DOM fica limitado pelo overscan —
 *     virtualização efetiva (não devemos ter centenas de itens no DOM mesmo
 *     com datasets grandes).
 *  4. O loader (`novelty-infinite-loader`) com `aria-busy`/`aria-live` aparece
 *     durante a paginação e some quando `hasMore` vira false.
 *  5. `clientHeight` do scroller fica estável (jitter ≤ 4px) durante rolagem.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — virtualização & estabilidade', () => {
  test.beforeEach(() => requireAuth());

  test('overscan/estimateSize são sãos, altura estável, loader cicla corretamente', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/novidades');
    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Sem novidades no dataset — virtualização não aplicável.');
      return;
    }

    // 1) Parâmetros do virtualizer dentro de faixas sãs.
    const overscan = Number(await scroller.getAttribute('data-grid-overscan'));
    const estimate = Number(await scroller.getAttribute('data-grid-estimate-size'));
    expect(overscan).toBeGreaterThanOrEqual(2);
    expect(overscan).toBeLessThanOrEqual(10);
    expect(estimate).toBeGreaterThanOrEqual(380);
    expect(estimate).toBeLessThanOrEqual(560);

    // 2) data-grid-scroll-height ≈ clientHeight do container.
    const measured = await scroller.evaluate((el) => ({
      attr: Number(el.getAttribute('data-grid-scroll-height')),
      ch: el.clientHeight,
    }));
    expect(measured.attr).toBeGreaterThan(0);
    expect(Math.abs(measured.attr - measured.ch)).toBeLessThanOrEqual(2);

    // 3) Virtualização efetiva: itens no DOM ≤ ~3 viewports * colunas.
    const domCount = await page.locator('div[role="listitem"]').count();
    expect(domCount).toBeLessThan(120);

    const loader = page.getByTestId('novelty-infinite-loader');
    const loaderInitiallyPresent = (await loader.count()) > 0;

    if (loaderInitiallyPresent) {
      // 4) A11y do loader.
      await expect(loader).toHaveAttribute('aria-live', 'polite');
      const busy = await loader.getAttribute('aria-busy');
      expect(['true', 'false']).toContain(busy);

      // Avança paginação rolando o container até o fim repetidamente.
      for (let i = 0; i < 30; i += 1) {
        await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
        await page.waitForTimeout(220);
        if ((await loader.count()) === 0) break;
      }
      await expect(loader).toHaveCount(0, { timeout: 10_000 });
    }

    // 5) Altura medida + clientHeight permanecem estáveis ao rolar.
    const heightSamples: number[] = [];
    const attrSamples: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      await scroller.evaluate((el, step) => el.scrollBy({ top: step }), 500);
      await page.waitForTimeout(150);
      const m = await scroller.evaluate((el) => ({
        ch: el.clientHeight,
        attr: Number(el.getAttribute('data-grid-scroll-height')),
      }));
      heightSamples.push(m.ch);
      attrSamples.push(m.attr);
    }
    expect(Math.max(...heightSamples) - Math.min(...heightSamples)).toBeLessThanOrEqual(4);
    expect(Math.max(...attrSamples) - Math.min(...attrSamples)).toBeLessThanOrEqual(4);
  });
});
