/**
 * E2E — Skeleton/loader de paginação infinita em /novidades.
 *
 * Valida o ciclo do loader que adicionamos no `NoveltyProductGrid`:
 *  - `[data-testid="novelty-infinite-loader"]` aparece quando há `hasMore`
 *    (após o virtualizer montar e antes de ter renderizado todos os itens).
 *  - Possui atributos a11y corretos: `aria-live="polite"` e `aria-busy`.
 *  - Some quando todos os itens da página foram revelados (sentinel desaparece
 *    porque `hasMore` vira false).
 *
 * Estratégia: rola a janela progressivamente até o fim do documento,
 * forçando `setVisibleCount` a alcançar `filteredProducts.length`. Em
 * datasets pequenos (< 40 itens) o loader pode nem aparecer — nesse caso
 * pulamos o teste sem falhar.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — loader de paginação infinita', () => {
  test.beforeEach(() => requireAuth());

  test('skeleton/loader aparece com aria-live/aria-busy e some ao final', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
    await expect(list).toBeVisible({ timeout: 15_000 });

    const items = await page.locator('div[role="listitem"]').count();
    if (items === 0) {
      test.skip(true, 'Sem novidades no dataset — paginação não aplicável.');
      return;
    }

    const loader = page.getByTestId('novelty-infinite-loader');

    // Se o dataset for menor que `visibleCount` inicial (40), o loader nunca
    // aparece — neste caso pulamos sem falhar para não criar flake.
    const initialLoaderVisible = await loader
      .isVisible()
      .catch(() => false);
    if (!initialLoaderVisible) {
      // Tenta forçar rolando até quase o fim — talvez o loader esteja fora do
      // viewport mas exista no DOM.
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(400);
      if ((await loader.count()) === 0) {
        test.skip(
          true,
          'Dataset pequeno — `hasMore` é sempre false e o loader não monta.',
        );
        return;
      }
    }

    // 1) Loader presente → valida atributos de acessibilidade.
    await expect(loader).toBeAttached();
    await expect(loader).toHaveAttribute('aria-live', 'polite');
    const ariaBusy = await loader.getAttribute('aria-busy');
    expect(['true', 'false']).toContain(ariaBusy);

    // 2) Avança a paginação rolando até o fim várias vezes; cada rolagem
    //    dispara `onLoadMore` no `useWindowVirtualizer`.
    for (let i = 0; i < 30; i += 1) {
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(250);
      if ((await loader.count()) === 0) break;
    }

    // 3) Ao final, o loader DEVE ter sumido (hasMore = false).
    await expect(loader).toHaveCount(0, { timeout: 10_000 });

    // 4) Sanity: ainda há itens renderizados.
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);
  });
});
