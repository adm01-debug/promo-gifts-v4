/**
 * QuoteItemsTable · cantos arredondados do header e wrapper.
 *
 * Valida em 390 / 768 / 1280 sobre `/__visual/quote-view-order`:
 *  - Wrapper externo mantém border-radius > 0 nos 4 cantos e recorta o conteúdo.
 *  - Primeira `th` tem border-top-left-radius > 0.
 *  - Última `th` (visível) tem border-top-right-radius > 0.
 *  - O overflow horizontal, quando existir por causa do min-width da tabela,
 *    fica contido no scroller e não aumenta a largura do documento.
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

    const fixture = page.getByTestId('quote-items-table-fixture-many');
    const wrapper = fixture.getByTestId('quote-items-table-wrapper');
    const scroller = fixture.getByTestId('quote-items-table-scroll');
    const cornerMask = fixture.getByTestId('quote-items-table-scrollbar-corner-mask');
    await expect(wrapper).toBeVisible();
    await expect(scroller).toBeVisible();
    await expect(cornerMask).toBeVisible();

    // Wrapper visual: 4 cantos arredondados e overflow hidden, que é o que recorta
    // o header azul quando a tabela usa min-width e/ou há scrollbar interna.
    const MIN_RADIUS_PX = 2;
    const wrapperMetrics = await wrapper.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        tl: cs.borderTopLeftRadius,
        tr: cs.borderTopRightRadius,
        bl: cs.borderBottomLeftRadius,
        br: cs.borderBottomRightRadius,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        rectRight: el.getBoundingClientRect().right,
      };
    });
    for (const [corner, value] of Object.entries({
      tl: wrapperMetrics.tl,
      tr: wrapperMetrics.tr,
      bl: wrapperMetrics.bl,
      br: wrapperMetrics.br,
    })) {
      expect(
        px(value),
        `wrapper ${corner} @${vp.name} = "${value}" (esperado >= ${MIN_RADIUS_PX}px)`,
      ).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    }
    expect(wrapperMetrics.overflowX, `wrapper overflow-x @${vp.name}`).toBe('hidden');
    expect(wrapperMetrics.overflowY, `wrapper overflow-y @${vp.name}`).toBe('hidden');

    // Overflow: a tabela pode ser maior que o viewport no mobile (min-width),
    // mas esse excesso precisa ficar contido no scroller, sem alargar o documento.
    const overflow = await scroller.evaluate((el) => {
      const documentWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;
      const table = el.querySelector('table');
      const tableWidth = table?.getBoundingClientRect().width ?? 0;
      return {
        scrollerScrollWidth: el.scrollWidth,
        scrollerClientWidth: el.clientWidth,
        documentWidth,
        viewportWidth,
        tableWidth,
      };
    });
    expect(
      overflow.documentWidth,
      `document width (${overflow.documentWidth}) não deve exceder viewport (${overflow.viewportWidth}) @${vp.name}`,
    ).toBeLessThanOrEqual(overflow.viewportWidth + 2);
    expect(
      overflow.scrollerScrollWidth,
      `scroller deve conter a largura da tabela @${vp.name}`,
    ).toBeGreaterThanOrEqual(Math.round(overflow.tableWidth) - 2);
    expect(
      overflow.scrollerClientWidth,
      `scroller visível deve caber no wrapper @${vp.name}`,
    ).toBeLessThanOrEqual(Math.round(wrapperMetrics.rectRight) + 2);

    // Header: 1ª th com TL>0; última th com TR>0.
    const ths = scroller.locator('thead tr > th');
    const count = await ths.count();
    expect(count).toBeGreaterThan(1);

    const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const lastTr = await ths.nth(count - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);

    expect(px(firstTl), `1ª th TL @${vp.name} = "${firstTl}"`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(px(lastTr), `última th TR @${vp.name} = "${lastTr}"`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);

    // O fundo azul deve estar nas células, não no <tr>; com border-collapse: collapse
    // + background no <tr>, Chromium/WebKit podem pintar um canto quadrado apesar
    // do border-radius computado no th.
    const paintModel = await scroller.locator('thead tr').evaluate((el) => {
      const table = el.closest('table');
      const rowBg = getComputedStyle(el).backgroundColor;
      const tableCollapse = table ? getComputedStyle(table).borderCollapse : '';
      return { rowBg, tableCollapse };
    });
    expect(paintModel.rowBg, `thead tr não deve pintar fundo próprio @${vp.name}`).toBe('rgba(0, 0, 0, 0)');
    expect(paintModel.tableCollapse, `table border-collapse @${vp.name}`).toBe('separate');

    const cornerMaskMetrics = await cornerMask.evaluate((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        bg: cs.backgroundColor,
        radius: cs.borderTopRightRadius,
        width: rect.width,
        height: rect.height,
      };
    });
    expect(
      px(cornerMaskMetrics.radius),
      `máscara do canto direito deve manter arredondamento @${vp.name}`,
    ).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(cornerMaskMetrics.width, `máscara cobre trilho da scrollbar @${vp.name}`).toBeGreaterThanOrEqual(12);
    expect(cornerMaskMetrics.height, `máscara cobre altura do header @${vp.name}`).toBeGreaterThanOrEqual(32);
    expect(cornerMaskMetrics.bg, `máscara deve usar fundo azul do header @${vp.name}`).not.toBe('rgba(0, 0, 0, 0)');
  });
}
