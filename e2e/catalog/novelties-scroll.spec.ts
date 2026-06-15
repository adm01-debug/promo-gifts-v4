/**
 * E2E — Scroll do módulo Novidades.
 *
 * Garante que após o fix de altura flexível dos cards (`min-h-[420px]`
 * sem `max-h` / `h-fixo`), o módulo /novidades:
 *  1. Permite scroll vertical no wrapper da lista.
 *  2. O virtualizer renderiza corretamente ao rolar esse wrapper.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — scroll + virtualizer', () => {
  test.beforeEach(() => requireAuth());

  test('página /novidades permite scroll e o virtualizer renderiza ao rolar', async ({
    page,
  }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    // Espera o virtualizer montar (lista presente).
    const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
    await expect(list).toBeVisible({ timeout: 15_000 });

    // Pula sem falhar se o dataset estiver vazio neste ambiente.
    const initialItems = await page.locator('div[role="listitem"]').count();
    if (initialItems === 0) {
      test.skip(true, 'Nenhuma novidade no dataset atual — scroll não aplicável.');
      return;
    }

    // 1) O wrapper do virtualizer deve ser o container de scroll estável.
    const metrics = await list.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        overflowY: cs.overflowY,
      };
    });
    expect(metrics.overflowY).toMatch(/auto|scroll/);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    // 2) Captura ids visíveis antes de rolar.
    const before = await page
      .locator('div[role="listitem"] article')
      .evaluateAll((nodes) => nodes.map((_, i) => i).length);

    // Rola o wrapper até quase o fim.
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight - el.clientHeight - 24));
    await page.waitForTimeout(400);

    // scrollTop do wrapper deve ter avançado.
    const scrollTop = await list.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(100);

    // 3) O virtualizer deve ter renderizado linhas (count > 0 após scroll).
    const afterCount = await page.locator('div[role="listitem"]').count();
    expect(afterCount).toBeGreaterThan(0);

    // 4) Volta ao topo — scrollTop ~ 0 e itens continuam renderizando.
    await list.evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const topY = await list.evaluate((el) => el.scrollTop);
    expect(topY).toBeLessThan(50);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // Sanity: contagem inicial foi maior que zero.
    expect(before).toBeGreaterThan(0);
  });
});
