/**
 * QuoteItemsTable · header fora do scroller + alinhamento de colunas.
 *
 * Valida em 390 / 768 / 1280 sobre `/__visual/quote-view-order`:
 *  - Wrapper externo mantém border-radius > 0 nos 4 cantos e recorta o conteúdo.
 *  - `<thead>` NÃO pertence ao DOM do scroller (header fica fora da área rolável).
 *  - `<tbody>` pertence ao scroller.
 *  - 1ª th tem border-top-left-radius > 0 e última th tem border-top-right-radius > 0
 *    (não há mais cornerMask sobrepondo cantos — sem pixel preto na borda azul).
 *  - Larguras das colunas do header e do corpo ficam alinhadas (Δ ≤ 2px) antes e
 *    durante o scroll vertical/horizontal.
 *  - Header não se move quando o body rola (top constante).
 *  - Não há corte, sobreposição ou overflow lateral no documento (390/768/1280).
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

const MIN_RADIUS_PX = 2;
const ALIGN_TOLERANCE_PX = 2;

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] header fora do scroller, colunas alinhadas e cantos arredondados`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    const fixture = page.getByTestId('quote-items-table-fixture-many');
    const wrapper = fixture.getByTestId('quote-items-table-wrapper');
    const headerWrap = fixture.getByTestId('quote-items-table-header-wrap');
    const scroller = fixture.getByTestId('quote-items-table-scroll');
    await expect(wrapper).toBeVisible();
    await expect(headerWrap).toBeVisible();
    await expect(scroller).toBeVisible();

    // ── Wrapper: 4 cantos arredondados e overflow hidden.
    const wrapperMetrics = await wrapper.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tl: cs.borderTopLeftRadius,
        tr: cs.borderTopRightRadius,
        bl: cs.borderBottomLeftRadius,
        br: cs.borderBottomRightRadius,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        left: r.left,
        right: r.right,
        width: r.width,
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
        `wrapper ${corner} @${vp.name} = "${value}" (>= ${MIN_RADIUS_PX}px)`,
      ).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    }
    expect(wrapperMetrics.overflowX).toBe('hidden');
    expect(wrapperMetrics.overflowY).toBe('hidden');

    // ── Documento não estoura horizontalmente em nenhum breakpoint.
    const docMetrics = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    }));
    expect(
      docMetrics.doc,
      `document (${docMetrics.doc}) <= viewport (${docMetrics.vw}) @${vp.name}`,
    ).toBeLessThanOrEqual(docMetrics.vw + 2);

    // ── Header fora do scroller: thead NÃO pertence ao scroll container,
    // tbody pertence. Garante que o scroll começa abaixo do header.
    const domTopology = await fixture.evaluate((fx) => {
      const sc = fx.querySelector('[data-testid="quote-items-table-scroll"]');
      const thead = fx.querySelector('thead');
      const tbody = fx.querySelector('tbody');
      const hw = fx.querySelector('[data-testid="quote-items-table-header-wrap"]');
      return {
        theadInScroller: !!(sc && thead && sc.contains(thead)),
        tbodyInScroller: !!(sc && tbody && sc.contains(tbody)),
        theadInHeaderWrap: !!(hw && thead && hw.contains(thead)),
      };
    });
    expect(domTopology.theadInScroller, `<thead> NÃO deve estar no scroller @${vp.name}`).toBe(false);
    expect(domTopology.tbodyInScroller, `<tbody> deve estar no scroller @${vp.name}`).toBe(true);
    expect(domTopology.theadInHeaderWrap, `<thead> deve estar no header-wrap @${vp.name}`).toBe(true);

    // ── Scroller continua rolável (vertical + horizontal) sem scrollbar-gutter.
    const scrollerCss = await scroller.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowX: cs.overflowX, overflowY: cs.overflowY };
    });
    expect(scrollerCss.overflowX).toBe('auto');
    expect(scrollerCss.overflowY).toBe('auto');

    // ── Cantos do header (sem cornerMask): TL na 1ª th, TR na última th.
    const ths = headerWrap.locator('thead tr > th');
    const thCount = await ths.count();
    expect(thCount).toBeGreaterThan(1);

    const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const lastTr = await ths.nth(thCount - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);
    expect(px(firstTl), `1ª th TL @${vp.name}`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(px(lastTr), `última th TR @${vp.name}`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);

    // cornerMask antigo NÃO deve mais existir (era fonte do pixel preto na borda).
    await expect(fixture.getByTestId('quote-items-table-scrollbar-corner-mask')).toHaveCount(0);

    // ── Modelo de pintura: <tr> transparente + border-separate (impede que
    // bordas da célula vazem por cima do background azul do <th>).
    const paintModel = await ths.first().evaluate((th) => {
      const tr = th.closest('tr')!;
      const table = th.closest('table')!;
      return {
        rowBg: getComputedStyle(tr).backgroundColor,
        collapse: getComputedStyle(table).borderCollapse,
        thBg: getComputedStyle(th).backgroundColor,
      };
    });
    expect(paintModel.rowBg).toBe('rgba(0, 0, 0, 0)');
    expect(paintModel.collapse).toBe('separate');
    expect(paintModel.thBg).not.toBe('rgba(0, 0, 0, 0)');

    // ── Alinhamento de colunas header ↔ corpo (Δ ≤ 2px) — regressão visual
    // contra desalinhamento causado por reservas distintas de scrollbar.
    const tds = scroller.locator(
      'tbody tr:not([class*="bg-accent"]):not([class*="bg-muted/30"])',
    ).first().locator('td');
    const tdCount = await tds.count();
    expect(tdCount, `header e body devem ter o mesmo nº de colunas @${vp.name}`).toBe(thCount);

    const alignments: Array<{ i: number; dLeft: number; dRight: number; dWidth: number }> = [];
    for (let i = 0; i < thCount; i++) {
      const pair = await ths.nth(i).evaluate(
        (thEl, tdEl) => {
          const a = thEl.getBoundingClientRect();
          const b = (tdEl as HTMLElement).getBoundingClientRect();
          return {
            dLeft: Number((b.left - a.left).toFixed(2)),
            dRight: Number((b.right - a.right).toFixed(2)),
            dWidth: Number((b.width - a.width).toFixed(2)),
          };
        },
        await tds.nth(i).elementHandle(),
      );
      alignments.push({ i, ...pair });
      expect(
        Math.abs(pair.dLeft),
        `col[${i}] dLeft @${vp.name} = ${pair.dLeft}px`,
      ).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
      expect(
        Math.abs(pair.dRight),
        `col[${i}] dRight @${vp.name} = ${pair.dRight}px`,
      ).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
      expect(
        Math.abs(pair.dWidth),
        `col[${i}] dWidth @${vp.name} = ${pair.dWidth}px`,
      ).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
    }

    // ── Larguras de coluna > 0 e top do header dentro do wrapper (sem corte).
    const headerWrapRect = await headerWrap.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, height: r.height };
    });
    for (let i = 0; i < thCount; i++) {
      const box = await ths.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, width: r.width, height: r.height };
      });
      expect(box.width, `th[${i}] width > 0 @${vp.name}`).toBeGreaterThan(0);
      expect(box.height, `th[${i}] height > 0 @${vp.name}`).toBeGreaterThan(0);
      expect(box.left).toBeGreaterThanOrEqual(headerWrapRect.left - 2);
      expect(box.right).toBeLessThanOrEqual(headerWrapRect.right + 2);
    }

    // ── Header NÃO se move quando o body rola verticalmente (regressão sticky).
    const theadTopBefore = await headerWrap
      .locator('thead')
      .evaluate((el) => el.getBoundingClientRect().top);
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(150);
    const theadTopAfter = await headerWrap
      .locator('thead')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(
      Math.abs(theadTopAfter - theadTopBefore),
      `header top constante após scrollTop=end @${vp.name}`,
    ).toBeLessThanOrEqual(1);

    // ── Alinhamento de colunas se mantém com o body rolado.
    for (let i = 0; i < thCount; i++) {
      const pair = await ths.nth(i).evaluate(
        (thEl, tdEl) => {
          const a = thEl.getBoundingClientRect();
          const b = (tdEl as HTMLElement).getBoundingClientRect();
          return {
            dLeft: Number((b.left - a.left).toFixed(2)),
            dWidth: Number((b.width - a.width).toFixed(2)),
          };
        },
        await tds.nth(i).elementHandle(),
      );
      expect(
        Math.abs(pair.dLeft),
        `col[${i}] dLeft após scroll @${vp.name} = ${pair.dLeft}px`,
      ).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
      expect(
        Math.abs(pair.dWidth),
        `col[${i}] dWidth após scroll @${vp.name} = ${pair.dWidth}px`,
      ).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
    }

    await scroller.evaluate((el) => {
      el.scrollTop = 0;
    });
  });
}
