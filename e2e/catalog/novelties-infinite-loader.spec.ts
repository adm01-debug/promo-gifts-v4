/**
 * E2E — Skeleton/loader de paginação infinita em /novidades.
 *
 * O loader (`novelty-infinite-loader`) vive DENTRO do container de scroll
 * interno (`novelty-grid-scroll`). Valida:
 *  - Atributos a11y: `aria-live="polite"` e `aria-busy` ('true'|'false').
 *  - Aparece quando `hasMore` é true (após o virtualizer montar).
 *  - Desaparece quando todos os itens foram revelados (hasMore vira false).
 *  - O scroll que dispara o load-more é o do CONTAINER, não da janela.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — loader de paginação infinita (scroll interno)', () => {
  test.beforeEach(() => requireAuth());

  test('skeleton/loader aparece com aria-live/aria-busy e some ao final', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const scroller = page.getByTestId('novelty-grid-scroll');
    await expect(scroller).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Sem novidades no dataset — paginação não aplicável.');
      return;
    }

    const loader = page.getByTestId('novelty-infinite-loader');

    // Dataset pequeno (< 40): loader nunca aparece. Pula sem falhar.
    if ((await loader.count()) === 0) {
      await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await page.waitForTimeout(400);
      if ((await loader.count()) === 0) {
        test.skip(true, 'Dataset pequeno — hasMore é sempre false.');
        return;
      }
    }

    // 1) A11y.
    await expect(loader).toBeAttached();
    await expect(loader).toHaveAttribute('aria-live', 'polite');
    const ariaBusy = await loader.getAttribute('aria-busy');
    expect(['true', 'false']).toContain(ariaBusy);

    // 2) Avança paginação rolando o CONTAINER até o fim repetidamente.
    for (let i = 0; i < 30; i += 1) {
      await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await page.waitForTimeout(250);
      if ((await loader.count()) === 0) break;
    }

    // 3) Loader sumiu (hasMore = false).
    await expect(loader).toHaveCount(0, { timeout: 10_000 });

    // 4) Sanity: itens ainda renderizados.
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);
  });
});
