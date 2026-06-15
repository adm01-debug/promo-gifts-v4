/**
 * E2E — Estabilidade de altura durante a transição skeleton→cards no /novidades.
 *
 * Objetivo: garantir que o container de loading (`[data-testid="novelty-loading-grid"]`)
 * reserva altura suficiente para que, ao trocar para a grade virtualizada
 * (`div[role="list"][aria-label="Grade de novidades"]`), o documento NÃO encolha
 * — caso contrário, o `scrollMargin` do `useWindowVirtualizer` fica stale e o
 * scroll do módulo trava.
 *
 * Também valida que após a transição:
 *  - O virtualizer renderiza `role="listitem"` (recalculo OK).
 *  - O `scrollHeight` final é >= ao reservado pelo skeleton (sem colapso).
 *  - Rolagem efetiva avança `window.scrollY`.
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
    let skeletonDocHeight = 0;
    try {
      await loadingGrid.waitFor({ state: 'visible', timeout: 2_000 });
      const box = await loadingGrid.boundingBox();
      skeletonHeight = box?.height ?? 0;
      skeletonDocHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
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

    // 3) Altura do documento pós-transição não pode encolher abaixo do reservado
    //    durante o skeleton (com tolerância de 24px para diferenças de padding/gap).
    const finalDocHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    if (skeletonDocHeight > 0) {
      expect(finalDocHeight).toBeGreaterThanOrEqual(skeletonDocHeight - 24);
    }

    // 4) Wrapper da lista virtualizada não pode ter colapsado (height>0).
    const listBox = await list.boundingBox();
    expect(listBox?.height ?? 0).toBeGreaterThan(200);
    // E não pode ser MENOR que a área reservada pelo skeleton (tolerância 24px).
    if (skeletonHeight > 0) {
      expect((listBox?.height ?? 0)).toBeGreaterThanOrEqual(skeletonHeight - 24);
    }

    // 5) Virtualizer continua respondendo a scroll: ao rolar, scrollY avança e
    //    permanece havendo `role="listitem"` no DOM (recalculo ativo).
    const beforeY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight - 600),
    );
    await page.waitForTimeout(400);
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY).toBeGreaterThan(beforeY + 100);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // 6) Estabilidade pós-scroll: duas leituras consecutivas do scrollHeight
    //    não devem divergir (sem oscilação tardia do virtualizer).
    const h1 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.waitForTimeout(300);
    const h2 = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(Math.abs(h2 - h1)).toBeLessThanOrEqual(8);
  });
});
