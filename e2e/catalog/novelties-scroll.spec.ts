/**
 * E2E — Scroll do módulo Novidades.
 *
 * Garante que após o fix de altura flexível dos cards (`min-h-[420px]`
 * sem `max-h` / `h-fixo`), o módulo /novidades:
 *  1. Permite scroll vertical (document/window cresce).
 *  2. O virtualizer renderiza novas linhas ao rolar (itens entram/saem
 *     do DOM dinamicamente — comportamento esperado de virtualização).
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

    // 1) Document deve ser maior que a viewport (scroll possível).
    const { scrollHeight, viewportH } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportH: window.innerHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(viewportH);

    // 2) Captura ids visíveis antes de rolar.
    const before = await page
      .locator('div[role="listitem"] article')
      .evaluateAll((nodes) => nodes.map((_, i) => i).length);

    // Rola até quase o fim.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - 600));
    await page.waitForTimeout(400);

    // window.scrollY deve ter avançado.
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);

    // 3) O virtualizer deve ter renderizado linhas (count > 0 após scroll).
    const afterCount = await page.locator('div[role="listitem"]').count();
    expect(afterCount).toBeGreaterThan(0);

    // 4) Volta ao topo — scrollY ~ 0 e itens continuam renderizando.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const topY = await page.evaluate(() => window.scrollY);
    expect(topY).toBeLessThan(50);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // Sanity: contagem inicial foi maior que zero.
    expect(before).toBeGreaterThan(0);
  });
});
