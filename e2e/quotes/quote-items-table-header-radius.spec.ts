/**
 * QuoteItemsTable · cantos arredondados do header e wrapper.
 *
 * Valida em 390 / 768 / 1280 sobre `/__visual/quote-view-order`:
 *  - Wrapper scroller mantém border-radius > 0 nos 4 cantos.
 *  - Primeira `th` tem border-top-left-radius > 0.
 *  - Última `th` (visível) tem border-top-right-radius > 0.
 *  - scrollWidth não excede clientWidth do wrapper (sem overflow horizontal
 *    indesejado em mobile).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

function px(v: string): number {
  return Number.parseFloat(v) || 0;
}

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] header e wrapper preservam cantos arredondados`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    const scroller = page
      .getByTestId('quote-items-table-fixture')
      .getByTestId('quote-items-table-scroll');
    await expect(scroller).toBeVisible();

    // Wrapper: 4 cantos arredondados.
    const wrapperRadii = await scroller.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        tl: cs.borderTopLeftRadius,
        tr: cs.borderTopRightRadius,
        bl: cs.borderBottomLeftRadius,
        br: cs.borderBottomRightRadius,
        sw: el.scrollWidth,
        cw: el.clientWidth,
      };
    });
    expect(px(wrapperRadii.tl), `wrapper TL @${vp.name}`).toBeGreaterThan(0);
    expect(px(wrapperRadii.tr), `wrapper TR @${vp.name}`).toBeGreaterThan(0);
    expect(px(wrapperRadii.bl), `wrapper BL @${vp.name}`).toBeGreaterThan(0);
    expect(px(wrapperRadii.br), `wrapper BR @${vp.name}`).toBeGreaterThan(0);

    // Sem overflow horizontal além do scroll legítimo (tolerância 1px).
    expect(
      wrapperRadii.sw,
      `scrollWidth (${wrapperRadii.sw}) <= clientWidth (${wrapperRadii.cw}) + 1 @${vp.name}`,
    ).toBeLessThanOrEqual(wrapperRadii.cw + 1);

    // Header: 1ª th com TL>0; última th com TR>0.
    const ths = scroller.locator('thead tr > th');
    const count = await ths.count();
    expect(count).toBeGreaterThan(1);

    const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const lastTr = await ths.nth(count - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);

    expect(px(firstTl), `1ª th TL @${vp.name}`).toBeGreaterThan(0);
    expect(px(lastTr), `última th TR @${vp.name}`).toBeGreaterThan(0);
  });
}
