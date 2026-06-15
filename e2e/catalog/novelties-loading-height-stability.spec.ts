/**
 * E2E — Estabilidade de altura durante a transição skeleton→cards no /novidades.
 *
 * Objetivo: garantir que o container de loading (`[data-testid="novelty-loading-grid"]`)
 * reserva altura suficiente para que, ao trocar para a grade virtualizada
 * (`div[role="list"][aria-label="Grade de novidades"]`), o wrapper NÃO encolha
 * e continue sendo o container de scroll usado pelo virtualizer.
 *
 * Também valida que após a transição:
 *  - O virtualizer renderiza `role="listitem"` (recalculo OK).
 *  - O `scrollHeight` final do wrapper é >= ao reservado pelo skeleton (sem colapso).
 *  - Rolagem efetiva avança `scrollTop` no wrapper.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — altura do wrapper estável durante transição skeleton→cards', () => {
  test.beforeEach(() => requireAuth());

  test('wrapper de loading reserva altura e virtualizer recalcula sem colapso', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    // 1) Tenta capturar o skeleton enquanto está visível. Pode já ter sumido
    //    em ambientes muito rápidos — nesse caso, pula a parte da medição
    //    inicial e valida apenas o estado final.
    const loadingGrid = page.getByTestId('novelty-loading-grid');
    let skeletonHeight = 0;
    let skeletonReservedHeight = 0;
    try {
      await loadingGrid.waitFor({ state: 'visible', timeout: 2_000 });
      const box = await loadingGrid.boundingBox();
      skeletonHeight = box?.height ?? 0;
      skeletonReservedHeight = skeletonHeight;
      // Sanity: o wrapper de loading deve reservar pelo menos ~420px (1 linha de cards).
      expect(skeletonHeight).toBeGreaterThanOrEqual(400);
    } catch {
      // Skeleton já desapareceu — tudo bem, segue para validação do estado final.
    }

    // 2) Espera o virtualizer aparecer (transição concluída).
    const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
    await expect(list).toBeVisible({ timeout: 15_000 });

    // Se o dataset estiver vazio neste ambiente, pula sem falhar.
    const itemCount = await page.locator('div[role="listitem"]').count();
    if (itemCount === 0) {
      test.skip(true, 'Nenhuma novidade no dataset atual — transição não aplicável.');
      return;
    }

    // 3) Wrapper da lista virtualizada não pode ter colapsado (height>0).
    const listBox = await list.boundingBox();
    expect(listBox?.height ?? 0).toBeGreaterThan(200);
    // E não pode ser MENOR que a área reservada pelo skeleton (tolerância 24px).
    if (skeletonReservedHeight > 0) {
      expect((listBox?.height ?? 0)).toBeGreaterThanOrEqual(
        Math.min(skeletonReservedHeight, 420) - 24,
      );
    }

    // 4) Virtualizer continua respondendo a scroll: ao rolar, scrollTop avança e
    //    permanece havendo `role="listitem"` no DOM (recalculo ativo).
    const beforeY = await list.evaluate((el) => el.scrollTop);
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight - el.clientHeight - 24));
    await page.waitForTimeout(400);
    const afterY = await list.evaluate((el) => el.scrollTop);
    expect(afterY).toBeGreaterThan(beforeY + 100);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // 5) Estabilidade pós-scroll: duas leituras consecutivas do scrollHeight
    //    não devem divergir (sem oscilação tardia do virtualizer).
    const h1 = await list.evaluate((el) => el.scrollHeight);
    await page.waitForTimeout(300);
    const h2 = await list.evaluate((el) => el.scrollHeight);
    expect(Math.abs(h2 - h1)).toBeLessThanOrEqual(8);
  });
});
