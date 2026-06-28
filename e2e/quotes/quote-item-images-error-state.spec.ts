/**
 * QuoteView thumbs — estado de erro (URL falhou / produto removido) mantém
 * exatamente as mesmas dimensões do thumb carregado e não causa overflow
 * horizontal em 320/375/768.
 *
 * Implementação: aborta toda requisição de imagem; `ProductThumb` deve cair
 * no placeholder com ícone preservando o tamanho via token (qvThumb.*).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

// Tamanhos nominais dos tokens qvThumb.
const ROW_NOMINAL = 58;
const SHEET_NOMINAL = 68;
const TOL = 2;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test(`placeholder de erro mantém tamanho e não gera overflow @ ${vp.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Aborta TODAS as imagens — força erro/placeholder.
    await page.route('**/*', (route) => {
      if (route.request().resourceType() === 'image') return route.abort();
      return route.continue();
    });

    await open(page);

    const rowThumb = page.getByTestId('quote-item-thumb').first();
    await expect(rowThumb).toBeVisible();
    const rBox = await rowThumb.boundingBox();
    expect(rBox).not.toBeNull();
    if (rBox) {
      expect(Math.abs(rBox.width - ROW_NOMINAL)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(rBox.height - ROW_NOMINAL)).toBeLessThanOrEqual(TOL);
    }

    const measure = () =>
      page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));

    const closed = await measure();
    expect(closed.sw, `[closed @${vp.name}]`).toBeLessThanOrEqual(closed.cw + 1);

    await page.getByTestId('quote-item-detail-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const sheetThumb = page.getByTestId('quote-detail-thumb').first();
    await expect(sheetThumb).toBeVisible();
    const sBox = await sheetThumb.boundingBox();
    if (sBox) {
      expect(Math.abs(sBox.width - SHEET_NOMINAL)).toBeLessThanOrEqual(TOL);
      expect(Math.abs(sBox.height - SHEET_NOMINAL)).toBeLessThanOrEqual(TOL);
    }

    const opened = await measure();
    expect(opened.sw, `[opened @${vp.name}]`).toBeLessThanOrEqual(opened.cw + 1);
  });
}
