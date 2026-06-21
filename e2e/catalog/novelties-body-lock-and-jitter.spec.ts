/**
 * E2E — Body/html não rolam em /novidades + ausência de jitter de altura.
 *
 * Garante que:
 *  1. Enquanto Novidades está montada, `<html>` e `<body>` têm
 *     `overflow: hidden` (sem scrollbar da janela).
 *  2. Existe APENAS uma região com scrollbar visível: o container do grid
 *     (`[data-testid="novelty-grid-scroll"]`), posicionado no lado direito
 *     dos produtos.
 *  3. Durante uma rolagem contínua dentro do container, o `clientHeight` do
 *     scroller permanece estável (jitter ≤ 4px) — sem "saltos" causados por
 *     remeasure do virtualizer ou pelo ResizeObserver.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — body-lock + jitter', () => {
  test.beforeEach(() => requireAuth());

  test('html/body com overflow hidden e scrollbar apenas no grid', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');
    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    // 1) html e body bloqueados.
    const overflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflow,
      body: getComputedStyle(document.body).overflow,
    }));
    expect(overflow.html).toBe('hidden');
    expect(overflow.body).toBe('hidden');

    // 2) Janela não rola mesmo forçando window.scrollTo.
    await page.evaluate(() => window.scrollTo(0, 5000));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(5);

    // 3) Apenas o container do grid tem overflow-y rolável.
    const scrollerOverflow = await scroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(scrollerOverflow);

    // 4) Scrollbar do container está à direita (scroller.right ~ viewport.right
    //    do lado dos produtos, não na lateral esquerda da página).
    const box = await scroller.boundingBox();
    const vw = page.viewportSize()?.width ?? 1280;
    expect(box).not.toBeNull();
    // O grid ocupa a metade direita do layout principal (sidebar à esquerda).
    if (box) expect(box.x + box.width / 2).toBeGreaterThan(vw / 3);
  });

  test('clientHeight do scroller fica estável durante rolagem contínua', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');
    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Sem novidades — jitter não aplicável.');
      return;
    }

    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      await scroller.evaluate((el, step) => el.scrollBy({ top: step }), 400);
      await page.waitForTimeout(150);
      samples.push(await scroller.evaluate((el) => el.clientHeight));
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min).toBeLessThanOrEqual(4);
  });
});
