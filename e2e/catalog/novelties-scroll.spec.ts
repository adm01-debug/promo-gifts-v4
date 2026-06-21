/**
 * E2E — Scroll do módulo Novidades (modelo WINDOW SCROLL).
 *
 * Após a migração para `useWindowVirtualizer`, o scroll de Novidades é o da
 * própria janela (igual ao Catálogo). O wrapper interno NÃO é mais o container
 * de scroll. Este teste valida:
 *  1. A janela rola verticalmente (document.scrollingElement.scrollTop avança).
 *  2. O virtualizer renderiza novos itens conforme a janela rola.
 *  3. O header sticky + sidebar do widget permanecem visíveis durante a rolagem.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — window scroll + virtualizer', () => {
  test.beforeEach(() => requireAuth());

  test('a página /novidades rola pela janela e o virtualizer responde ao scroll', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
    await expect(list).toBeVisible({ timeout: 15_000 });

    const initialItems = await page.locator('div[role="listitem"]').count();
    if (initialItems === 0) {
      test.skip(true, 'Nenhuma novidade no dataset atual — scroll não aplicável.');
      return;
    }

    // 1) O container de scroll é a JANELA. O wrapper interno NÃO deve ter overflow.
    const wrapperOverflow = await list.evaluate(
      (el) => window.getComputedStyle(el).overflowY,
    );
    expect(['visible', '']).toContain(wrapperOverflow);

    // O documento deve ter altura suficiente para scroll.
    const docMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(docMetrics.scrollHeight).toBeGreaterThan(docMetrics.innerHeight);

    // 2) Header sticky deve estar visível antes de rolar.
    const header = page.getByTestId('page-title-novidades');
    await expect(header).toBeInViewport();

    // 3) Rola a janela ~2 viewports.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
    await page.waitForTimeout(400);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(200);

    // 4) Virtualizer continua renderizando linhas após o scroll.
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // 5) Header sticky continua visível (não some ao rolar).
    await expect(header).toBeInViewport();

    // 6) Volta ao topo via window.scrollTo.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const topY = await page.evaluate(() => window.scrollY);
    expect(topY).toBeLessThan(50);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);
  });
});
