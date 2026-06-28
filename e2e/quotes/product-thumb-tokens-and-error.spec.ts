/**
 * ProductThumb — cobertura consolidada:
 *  1. errorMode ao falhar 404 da imagem (mantém razão 1:1).
 *  2. Coluna de resumo (drag thumb compact + summary thumb) sem overflow.
 *  3. Skeleton respeita exatamente as dimensões do token enquanto carrega.
 *
 * Roda em 320/375/768 sobre o harness dev-only do QuoteView.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

const RATIO_TOL = 0.02;
const DIM_TOL = 2;

// Espelho de qvThumb (não importável de spec — mantemos números nominais).
const TOKEN_PX = {
  row: 58,
  sheet: 68,
  summary: 58,
  list: 77,
  compact: 48,
} as const;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

function expectRatio1(box: { width: number; height: number }, label: string) {
  expect(box.width, `${label} w=0`).toBeGreaterThan(0);
  const r = box.width / box.height;
  expect(Math.abs(r - 1), `${label} ratio=${r.toFixed(3)}`).toBeLessThanOrEqual(RATIO_TOL);
}

for (const vp of VIEWPORTS) {
  test(`errorMode em 404 mantém ratio 1:1 @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // Responde 404 em toda imagem → onError → errored=true → placeholder.
    await page.route('**/*', (route) => {
      if (route.request().resourceType() === 'image') {
        return route.fulfill({ status: 404, body: '' });
      }
      return route.continue();
    });
    await open(page);

    const thumb = page.getByTestId('quote-item-thumb').first();
    await expect(thumb).toBeVisible();
    // Aguarda transição para state=error (onError dispara após 404).
    await expect(thumb).toHaveAttribute('data-state', /error|empty/);
    const box = await thumb.boundingBox();
    if (box) {
      expectRatio1(box, `[row @${vp.name}]`);
      expect(Math.abs(box.width - TOKEN_PX.row)).toBeLessThanOrEqual(DIM_TOL);
    }
  });

  test(`summary column sem overflow horizontal @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    expect(m.sw, `[summary overflow @${vp.name}]`).toBeLessThanOrEqual(m.cw + 1);

    // Se a coluna de resumo estiver renderizada, confere thumb summary.
    const sumThumb = page.getByTestId('quote-summary-thumb').first();
    if (await sumThumb.count()) {
      const sb = await sumThumb.boundingBox();
      if (sb) {
        expectRatio1(sb, `[summary @${vp.name}]`);
        expect(Math.abs(sb.width - TOKEN_PX.summary)).toBeLessThanOrEqual(DIM_TOL);
      }
    }
  });

  test(`skeleton respeita área do token enquanto carrega @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // Atrasa imagens para garantir skeleton visível.
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'image') {
        await new Promise((r) => setTimeout(r, 3000));
      }
      return route.continue();
    });
    await open(page);

    const thumb = page.getByTestId('quote-item-thumb').first();
    await expect(thumb).toBeVisible();
    // Em loading, skeleton interno deve existir e preencher a área.
    const state = await thumb.getAttribute('data-state');
    if (state === 'loading') {
      const skel = page.getByTestId('quote-item-thumb-skeleton').first();
      const tBox = await thumb.boundingBox();
      const sBox = await skel.boundingBox();
      if (tBox && sBox) {
        expect(Math.abs(sBox.width - tBox.width)).toBeLessThanOrEqual(DIM_TOL);
        expect(Math.abs(sBox.height - tBox.height)).toBeLessThanOrEqual(DIM_TOL);
        expectRatio1(tBox, `[skeleton @${vp.name}]`);
        expect(Math.abs(tBox.width - TOKEN_PX.row)).toBeLessThanOrEqual(DIM_TOL);
      }
    }
  });
}
