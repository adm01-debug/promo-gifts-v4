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

    // Wrapper: 4 cantos arredondados (tolerância 1px p/ subpixel cross-browser).
    const MIN_RADIUS_PX = 2;
    const wrapper = await scroller.evaluate((el) => {
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
    for (const [corner, value] of Object.entries({
      tl: wrapper.tl,
      tr: wrapper.tr,
      bl: wrapper.bl,
      br: wrapper.br,
    })) {
      expect(
        px(value),
        `wrapper ${corner} @${vp.name} = "${value}" (esperado >= ${MIN_RADIUS_PX}px)`,
      ).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    }

    // Overflow horizontal: tolerância 2px p/ arredondamento de layout em WebKit.
    expect(
      Math.round(wrapper.sw),
      `scrollWidth (${wrapper.sw}) <= clientWidth (${wrapper.cw}) + 2 @${vp.name}`,
    ).toBeLessThanOrEqual(Math.round(wrapper.cw) + 2);

    // Header: 1ª th com TL>0; última th com TR>0.
    const ths = scroller.locator('thead tr > th');
    const count = await ths.count();
    expect(count).toBeGreaterThan(1);

    const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const lastTr = await ths.nth(count - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);

    expect(px(firstTl), `1ª th TL @${vp.name} = "${firstTl}"`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(px(lastTr), `última th TR @${vp.name} = "${lastTr}"`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
  });
}
