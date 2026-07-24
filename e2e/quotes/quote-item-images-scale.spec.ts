/**
 * Imagens dos produtos no QuoteView/Sheet — escala +20% sem overflow.
 *
 * Garante:
 *  1. Thumbnail da linha de item (tabela/harness) renderiza com lado >= 56px
 *     (alvo nominal 58px ≈ 48px * 1.20).
 *  2. Imagem dentro do SheetContent renderiza com lado >= 64px
 *     (alvo nominal 68px ≈ 56px * 1.20).
 *  3. Em 320/375/768, com sheet aberto e fechado, não há overflow horizontal
 *     de página nem o SheetContent excede o viewport.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

const ROW_MIN = 56; // px — 58px nominal, tolera arredondamento
const SHEET_MIN = 64; // px — 68px nominal

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test(`thumbs +20% e sem overflow @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    // Thumbnail da linha (primeira imagem real dentro do harness).
    const rowImg = page
      .getByTestId('quote-view-order-harness')
      .locator('img[src]:not([src=""])')
      .first();
    if (await rowImg.count()) {
      const box = await rowImg.boundingBox();
      if (box) {
        expect(box.width, `[row @${vp.name}] thumb width ${box.width} < ${ROW_MIN}`).toBeGreaterThanOrEqual(ROW_MIN);
        expect(box.height, `[row @${vp.name}] thumb height ${box.height} < ${ROW_MIN}`).toBeGreaterThanOrEqual(ROW_MIN);
      }
    }

    const measure = () =>
      page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));

    const closed = await measure();
    expect(closed.scrollW, `[fechado @${vp.name}]`).toBeLessThanOrEqual(closed.clientW + 1);

    // Abre o sheet.
    await page.getByTestId('quote-item-detail-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Imagem dentro do sheet.
    const sheetImg = dialog.locator('img[src]:not([src=""])').first();
    if (await sheetImg.count()) {
      const sBox = await sheetImg.boundingBox();
      if (sBox) {
        expect(sBox.width, `[sheet @${vp.name}] img width ${sBox.width} < ${SHEET_MIN}`).toBeGreaterThanOrEqual(SHEET_MIN);
        expect(sBox.height, `[sheet @${vp.name}] img height ${sBox.height} < ${SHEET_MIN}`).toBeGreaterThanOrEqual(SHEET_MIN);
      }
    }

    const opened = await measure();
    expect(opened.scrollW, `[aberto @${vp.name}]`).toBeLessThanOrEqual(opened.clientW + 1);

    const dlgBox = await dialog.boundingBox();
    if (dlgBox) {
      expect(dlgBox.width, `[sheet width @${vp.name}]`).toBeLessThanOrEqual(vp.width + 1);
    }
  });
}
