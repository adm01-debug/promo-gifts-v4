/**
 * E2E — Paridade visual entre cards de /novidades e /reposicao.
 *
 * Mede o primeiro `role="listitem"` de cada grid e compara largura/altura
 * com tolerância pequena. Também valida que a imagem (aspect-square) tem
 * proporção ~1:1 nos dois módulos. Tira screenshots para diff visual.
 *
 * Skipa quando algum dos datasets está vazio (ambiente de smoke sem dados).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const TOL_PX = 4;

async function measureFirstCard(page: import('@playwright/test').Page, listSelector: string) {
  const list = page.locator(listSelector);
  await expect(list).toBeVisible({ timeout: 15_000 });
  const items = page.locator(`${listSelector} >> [role="listitem"]`);
  const count = await items.count();
  if (count === 0) return null;
  const first = items.first();
  const box = await first.boundingBox();
  const img = first.locator('img').first();
  const imgBox = (await img.count()) > 0 ? await img.boundingBox() : null;
  // Rodapé (preço + estoque) — usado para validar alinhamento bottom.
  const footer = first.locator(
    '[data-testid="product-card-footer"], [data-testid$="-card-footer"]',
  ).first();
  const footerBox = (await footer.count()) > 0 ? await footer.boundingBox() : null;
  return { box, imgBox, footerBox };
}

test.describe('Paridade visual — cards Novidades vs Reposição', () => {
  test.beforeEach(() => requireAuth());

  test('cards têm mesmas dimensões e imagem 1:1 nos dois módulos', async ({ page }, testInfo) => {
    // Novidades
    await gotoAndSettle(page, '/novidades');
    await expect(page.getByTestId('page-title-novidades')).toBeVisible();
    const novelty = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de novidades"]',
    );
    if (!novelty?.box) test.skip(true, 'Sem novidades no dataset.');
    await testInfo.attach('novidades.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    // Reposição
    await gotoAndSettle(page, '/reposicao');
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
    const repl = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de produtos repostos"]',
    );
    if (!repl?.box) test.skip(true, 'Sem reposições no dataset.');
    await testInfo.attach('reposicao.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const widthDiff = Math.abs(novelty!.box!.width - repl!.box!.width);
    const heightDiff = Math.abs(novelty!.box!.height - repl!.box!.height);
    const ratios = [novelty!, repl!].map((m) =>
      m.imgBox ? m.imgBox.width / Math.max(m.imgBox.height, 1) : null,
    );

    // Log diff para aparecer no --reporter=list e nos artefatos do CI.
    // eslint-disable-next-line no-console
    console.log(
      `[card-parity] widthDiff=${widthDiff.toFixed(2)}px heightDiff=${heightDiff.toFixed(2)}px ` +
        `ratios=[${ratios.map((r) => (r === null ? 'n/a' : r.toFixed(3))).join(', ')}] tolerance=${TOL_PX}px`,
    );
    await testInfo.attach('card-parity-diff.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            tolerance_px: TOL_PX,
            widthDiff_px: widthDiff,
            heightDiff_px: heightDiff,
            novelty_box: novelty!.box,
            repl_box: repl!.box,
            ratios,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });

    // 1) Larguras devem ser idênticas (mesmo grid responsivo).
    expect(widthDiff, `widthDiff=${widthDiff.toFixed(2)}px excede tolerância ${TOL_PX}px`).toBeLessThanOrEqual(TOL_PX);

    // 2) Alturas devem ser idênticas (mesmo min-h 420/430).
    expect(heightDiff, `heightDiff=${heightDiff.toFixed(2)}px excede tolerância ${TOL_PX}px`).toBeLessThanOrEqual(TOL_PX);

    // 3) Imagem com proporção ~1:1 em ambos.
    for (const m of [novelty!, repl!]) {
      if (m.imgBox) {
        const ratio = m.imgBox.width / Math.max(m.imgBox.height, 1);
        expect(ratio, `ratio=${ratio.toFixed(3)} fora de [0.9, 1.1]`).toBeGreaterThan(0.9);
        expect(ratio, `ratio=${ratio.toFixed(3)} fora de [0.9, 1.1]`).toBeLessThan(1.1);
      }
    }
  });
});
