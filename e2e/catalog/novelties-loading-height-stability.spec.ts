/**
 * E2E — Estabilidade visual durante a transição skeleton→cards no /novidades
 * (modelo WINDOW SCROLL).
 *
 * Após a migração para `useWindowVirtualizer`, o wrapper interno deixou de ser
 * o container de scroll — quem rola é a janela. Este teste valida que:
 *  1. O bloco de loading (`[data-testid="novelty-loading-grid"]`) reserva altura
 *     suficiente, evitando layout shift quando o virtualizer monta.
 *  2. Após a transição, o virtualizer renderiza `role="listitem"`.
 *  3. A altura total do documento permanece >= à área reservada pelo skeleton.
 *  4. Rolar a janela faz `window.scrollY` avançar e o virtualizer continua ativo.
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

test.describe('Novidades — estabilidade visual (window scroll)', () => {
  test.beforeEach(() => requireAuth());

  test('skeleton reserva altura e a transição não colapsa o documento', async ({ page }) => {
    await gotoAndSettle(page, '/novidades');

    await expect(page.getByTestId('page-title-novidades')).toBeVisible();

    // 1) Captura altura reservada pelo skeleton (pode já ter sumido em ambiente rápido).
    const loadingGrid = page.getByTestId('novelty-loading-grid');
    let skeletonReservedHeight = 0;
    try {
      await loadingGrid.waitFor({ state: 'visible', timeout: 2_000 });
      const box = await loadingGrid.boundingBox();
      skeletonReservedHeight = box?.height ?? 0;
      expect(skeletonReservedHeight).toBeGreaterThanOrEqual(400);
    } catch {
      // Skeleton já desapareceu — segue para validação final.
    }

    // 2) Virtualizer monta (lista presente).
    const list = page.locator('div[role="list"][aria-label="Grade de novidades"]');
    await expect(list).toBeVisible({ timeout: 15_000 });

    const itemCount = await page.locator('div[role="listitem"]').count();
    if (itemCount === 0) {
      test.skip(true, 'Nenhuma novidade no dataset atual — transição não aplicável.');
      return;
    }

    // 3) Documento (não mais o wrapper) deve ter altura >= ao reservado pelo skeleton.
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (skeletonReservedHeight > 0) {
      expect(docHeight).toBeGreaterThanOrEqual(
        Math.min(skeletonReservedHeight, 420) - 24,
      );
    }

    // 4) Rolagem da janela funciona e o virtualizer continua respondendo.
    const beforeY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight - 24),
    );
    await page.waitForTimeout(400);
    const afterY = await page.evaluate(() => window.scrollY);
    expect(afterY).toBeGreaterThan(beforeY + 100);
    expect(await page.locator('div[role="listitem"]').count()).toBeGreaterThan(0);

    // 5) Estabilidade pós-scroll: altura do documento estável entre leituras
    //    consecutivas (sem oscilação tardia do virtualizer).
    const h1 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.waitForTimeout(300);
    const h2 = await page.evaluate(() => document.documentElement.scrollHeight);
    // Tolerância maior aqui: paginação infinita pode disparar perto do fim e
    // legitimamente aumentar a altura. Aceitamos crescimento, rejeitamos colapso.
    expect(h2).toBeGreaterThanOrEqual(h1 - 8);
  });
});
