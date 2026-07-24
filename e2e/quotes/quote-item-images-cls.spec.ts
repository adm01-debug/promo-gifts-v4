/**
 * QuoteView thumbs — CLS zero & aspect ratio preservado em loading/loaded.
 *
 * Bloqueia respostas de imagens e mede o bounding box do thumb antes (skeleton)
 * e depois (img carregada) do load para garantir:
 *   1. Mesmas dimensões em ambos os estados (sem layout shift).
 *   2. Aspect ratio 1:1 mantido em 320/375/768, antes e depois.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

const RATIO_TOLERANCE = 0.02;
const DIM_TOLERANCE = 1; // px

function expectSquare(box: { width: number; height: number }, label: string) {
  expect(box.width, `${label} w=0`).toBeGreaterThan(0);
  const ratio = box.width / box.height;
  expect(Math.abs(ratio - 1), `${label} ratio ${ratio.toFixed(3)}`).toBeLessThanOrEqual(
    RATIO_TOLERANCE,
  );
}

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test(`thumbs mantêm dims+ratio antes e depois do load @ ${vp.name}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // Bloqueia imagens para forçar skeleton/empty inicialmente.
    let unblocked = false;
    await page.route('**/*', (route) => {
      const t = route.request().resourceType();
      if (!unblocked && t === 'image') return route.abort();
      return route.continue();
    });

    await open(page);

    const rowThumb = page.getByTestId('quote-item-thumb').first();
    const beforeRow = await rowThumb.boundingBox();
    expect(beforeRow, '[row before load]').not.toBeNull();
    if (beforeRow) expectSquare(beforeRow, `[row before @${vp.name}]`);

    // Abre sheet ainda com imagens bloqueadas.
    await page.getByTestId('quote-item-detail-trigger').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const sheetThumb = page.getByTestId('quote-detail-thumb').first();
    const beforeSheet = await sheetThumb.boundingBox();
    if (beforeSheet) expectSquare(beforeSheet, `[sheet before @${vp.name}]`);

    // Libera imagens e recarrega.
    unblocked = true;
    await page.reload();
    await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();

    const afterRow = await page.getByTestId('quote-item-thumb').first().boundingBox();
    if (afterRow) expectSquare(afterRow, `[row after @${vp.name}]`);

    if (beforeRow && afterRow) {
      expect(Math.abs(afterRow.width - beforeRow.width)).toBeLessThanOrEqual(DIM_TOLERANCE);
      expect(Math.abs(afterRow.height - beforeRow.height)).toBeLessThanOrEqual(DIM_TOLERANCE);
    }

    await page.getByTestId('quote-item-detail-trigger').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const afterSheet = await page.getByTestId('quote-detail-thumb').first().boundingBox();
    if (afterSheet) expectSquare(afterSheet, `[sheet after @${vp.name}]`);
    if (beforeSheet && afterSheet) {
      expect(Math.abs(afterSheet.width - beforeSheet.width)).toBeLessThanOrEqual(DIM_TOLERANCE);
      expect(Math.abs(afterSheet.height - beforeSheet.height)).toBeLessThanOrEqual(
        DIM_TOLERANCE,
      );
    }
  });
}
