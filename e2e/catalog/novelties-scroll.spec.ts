/**
 * E2E — Scroll do módulo Novidades (modelo SCROLL INTERNO).
 *
 * O grid de Novidades rola num container interno
 * `[data-testid="novelty-grid-scroll"]` (overflow-y: auto) — a janela do
 * navegador fica travada em `overflow: hidden`. Este teste valida:
 *  1. O container interno é o scroller (overflowY != visible, scrollTop avança).
 *  2. A janela NÃO rola (window.scrollY permanece ~0).
 *  3. O virtualizer continua renderizando itens conforme o scroll interno avança.
 *  4. O header sticky permanece visível.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — scroll interno do grid', () => {
  test.beforeEach(() => requireAuth());

  test('o grid rola internamente e a janela não rola', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Nenhuma novidade no dataset — scroll não aplicável.');
      return;
    }

    // 1) O container é scrollável.
    const overflowY = await scroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflowY);

    const metrics = await scroller.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // 2) Header sticky visível antes de rolar.
    const header = page.getByTestId('page-title-novidades');
    await expect(header).toBeInViewport();

    // 3) Rola o container ~2 alturas internas.
    await scroller.evaluate((el) => el.scrollTo({ top: el.clientHeight * 2 }));
    await page.waitForTimeout(400);

    const innerScroll = await scroller.evaluate((el) => el.scrollTop);
    expect(innerScroll).toBeGreaterThan(200);

    // 4) Janela NÃO rolou.
    const windowY = await page.evaluate(() => window.scrollY);
    expect(windowY).toBeLessThan(5);

    // 5) Virtualizer continua renderizando.
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // 6) Header sticky permanece visível.
    await expect(header).toBeInViewport();

    // 7) Volta ao topo via container.
    await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
    await page.waitForTimeout(300);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeLessThan(50);
  });
});
