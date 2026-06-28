/**
 * Imagens dos produtos no QuoteView/Sheet — aspect ratio 1:1 mantido (sem distorção).
 *
 * As thumbs de produto são quadradas (h-[58px] w-[58px] na tabela,
 * h-[68px] w-[68px] no sheet). Este teste garante que, ao escalar +20%,
 * a proporção continua 1:1 em 320/375/768 — sem squish/stretch causado
 * por flex/grid pais.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

// Tolerância de 1px para arredondamento sub-pixel.
const RATIO_TOLERANCE = 0.02;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

function expectSquare(box: { width: number; height: number }, label: string) {
  expect(box.width, `${label} width=0`).toBeGreaterThan(0);
  expect(box.height, `${label} height=0`).toBeGreaterThan(0);
  const ratio = box.width / box.height;
  expect(
    Math.abs(ratio - 1),
    `${label} aspect ratio ${ratio.toFixed(3)} ≠ 1 (w=${box.width}, h=${box.height})`,
  ).toBeLessThanOrEqual(RATIO_TOLERANCE);
}

for (const vp of VIEWPORTS) {
  test(`thumbs mantêm aspect ratio 1:1 @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    // Thumb(s) da linha de item — testa container (não <img>) para detectar
    // squish causado por flex pai; o container tem h/w fixos.
    const rowThumbs = page.getByTestId('quote-item-thumb');
    const rowCount = await rowThumbs.count();
    for (let i = 0; i < rowCount; i++) {
      const box = await rowThumbs.nth(i).boundingBox();
      if (box) expectSquare(box, `[row#${i} @${vp.name}]`);
    }

    // Abre o sheet.
    await page.getByTestId('quote-item-detail-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const sheetThumb = page.getByTestId('quote-detail-thumb');
    if (await sheetThumb.count()) {
      const box = await sheetThumb.first().boundingBox();
      if (box) expectSquare(box, `[sheet @${vp.name}]`);
    }
  });
}
