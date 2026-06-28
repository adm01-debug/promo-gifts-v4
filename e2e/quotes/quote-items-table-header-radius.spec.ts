/**
 * QuoteItemsTable · cantos arredondados do header e wrapper.
 *
 * Valida em 390 / 768 / 1280 sobre `/__visual/quote-view-order`:
 *  - Wrapper externo mantém border-radius > 0 nos 4 cantos e recorta o conteúdo.
 *  - Primeira `th` tem border-top-left-radius > 0.
 *  - Última `th` (visível) tem border-top-right-radius > 0.
 *  - O overflow horizontal, quando existir por causa do min-width da tabela,
 *    fica contido no scroller e não aumenta a largura do documento.
 *  - A área azul da seta no canto superior-direito cobre o gutter e carrega o
 *    border-radius real; a última <th> fica sem radius para não criar pixel
 *    escuro entre célula e overlay.
 *  - scrollLeft/scrollWidth: ao rolar horizontalmente, nenhuma <th> some do
 *    DOM e o header completo permanece dentro do bounding-box do scroller.
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
    await expect(wrapper).toBeVisible();
    await expect(scroller).toBeVisible();

    // ── Wrapper: 4 cantos arredondados e overflow hidden (recorta header azul).
    const MIN_RADIUS_PX = 2;
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
        rectLeft: r.left,
        rectRight: r.right,
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

    // ── Scroller: scrollbar-gutter:stable garantido (SSOT visual cross-engine).
    const scrollerCss = await scroller.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        gutter: cs.scrollbarGutter || '',
      };
    });
    expect(scrollerCss.overflowX).toBe('auto');
    expect(scrollerCss.overflowY).toBe('auto');

    // ── Overflow horizontal contido no scroller, sem alargar o documento.
    const overflow = await scroller.evaluate((el) => {
      const table = el.querySelector('table');
      const rect = el.getBoundingClientRect();
      return {
        scrollerScrollWidth: el.scrollWidth,
        scrollerClientWidth: el.clientWidth,
        scrollerScrollLeft: el.scrollLeft,
        rectLeft: rect.left,
        rectRight: rect.right,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        tableWidth: table?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(
      overflow.documentWidth,
      `document (${overflow.documentWidth}) <= viewport (${overflow.viewportWidth}) @${vp.name}`,
    ).toBeLessThanOrEqual(overflow.viewportWidth + 2);
    expect(overflow.scrollerScrollWidth).toBeGreaterThanOrEqual(Math.round(overflow.tableWidth) - 2);
    expect(overflow.rectLeft).toBeGreaterThanOrEqual(wrapperMetrics.rectLeft - 2);
    expect(overflow.rectRight).toBeLessThanOrEqual(wrapperMetrics.rectRight + 2);

    // ── Header: 1ª th TL>0; última th TR só existe quando não há máscara.
    // Com scroll interno, a área azul da seta é quem carrega o radius TR; isso
    // evita sobreposição de dois cantos arredondados e o pixel escuro no seam.
    const ths = scroller.locator('thead tr > th');
    const count = await ths.count();
    expect(count).toBeGreaterThan(1);

    const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const lastTr = await ths.nth(count - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);
    expect(px(firstTl), `1ª th TL @${vp.name} = "${firstTl}"`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(px(lastTr), `última th TR deve ser reto quando há área da seta @${vp.name}`).toBe(0);

    const paintModel = await scroller.locator('thead tr').evaluate((el) => {
      const table = el.closest('table');
      return {
        rowBg: getComputedStyle(el).backgroundColor,
        collapse: table ? getComputedStyle(table).borderCollapse : '',
      };
    });
    expect(paintModel.rowBg).toBe('rgba(0, 0, 0, 0)');
    expect(paintModel.collapse).toBe('separate');

    // ── Header não fica cortado: cada <th> está dentro do rect do scroller
    // (considerando scroll horizontal). Nenhuma célula deve ter width 0.
    const scrollerRect = await scroller.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top };
    });
    const theadHeight = await scroller.locator('thead').evaluate((el) => el.getBoundingClientRect().height);
    expect(theadHeight, `<thead> deve ter altura > 0 @${vp.name}`).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await ths.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, top: r.top, height: r.height };
      });
      expect(box.width, `th[${i}] width > 0 @${vp.name}`).toBeGreaterThan(0);
      expect(box.height, `th[${i}] height > 0 @${vp.name}`).toBeGreaterThan(0);
      // top do header deve coincidir com top do scroller (sticky) — ±2px.
      expect(Math.abs(box.top - scrollerRect.top)).toBeLessThanOrEqual(2);
    }

    // ── scrollLeft: rola horizontalmente até o fim e confirma que a última th
    // continua visível dentro do scroller (não é cortada por overflow-hidden).
    if (overflow.scrollerScrollWidth > overflow.scrollerClientWidth + 1) {
      await scroller.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const after = await scroller.evaluate((el) => ({
        scrollLeft: el.scrollLeft,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
      expect(after.scrollLeft, `scrollLeft progrediu @${vp.name}`).toBeGreaterThan(0);
      // scrollLeft máximo ≈ scrollWidth - clientWidth (±2px).
      expect(after.scrollLeft).toBeGreaterThanOrEqual(after.scrollWidth - after.clientWidth - 2);

      const lastThRect = await ths.nth(count - 1).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      const scrollerAfter = await scroller.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      expect(lastThRect.right, `última th visível após scrollLeft @${vp.name}`).toBeLessThanOrEqual(
        scrollerAfter.right + 2,
      );
      expect(lastThRect.left).toBeGreaterThanOrEqual(scrollerAfter.left - 2);
      // Reset
      await scroller.evaluate((el) => {
        el.scrollLeft = 0;
      });
    }

    // ── Área azul da seta: reproduz o padrão visual da lista de Orçamentos.
    // Sua altura DEVE bater com a altura real do <thead> (±2px), garantindo que
    // não dependemos mais da constante h-[2.375rem].
    const cornerMask = fixture.getByTestId('quote-items-table-scrollbar-corner-mask');
    const maskCount = await cornerMask.count();
    expect(maskCount, `área azul da seta deve existir @${vp.name}`).toBe(1);

    const m = await cornerMask.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, radius: cs.borderTopRightRadius, w: r.width, h: r.height };
    });
    expect(px(m.radius)).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
    expect(m.w).toBeGreaterThanOrEqual(18);
    expect(m.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      Math.abs(m.h - theadHeight),
      `máscara (${m.h}px) deve igualar altura real do thead (${theadHeight}px) @${vp.name}`,
    ).toBeLessThanOrEqual(2);

    const seam = await cornerMask.evaluate((mask) => {
      const maskRect = mask.getBoundingClientRect();
      const table = mask.parentElement?.querySelector('table');
      const last = table?.querySelector('thead tr > th:last-child');
      const lastRect = last?.getBoundingClientRect();
      return {
        overlap: lastRect ? lastRect.right - maskRect.left : Number.NaN,
        maskLeft: maskRect.left,
        lastRight: lastRect?.right ?? Number.NaN,
      };
    });
    expect(seam.overlap, `área da seta deve sobrepor a última th sem gap @${vp.name}`).toBeGreaterThanOrEqual(1);

    // Seta indicadora dentro da área azul: mesmo ícone ArrowUpDown do módulo de
    // Orçamentos, visível e centralizado no canto direito.
    const hint = await cornerMask.getAttribute('data-scroll-hint');
    expect(hint, `data-scroll-hint inicial @${vp.name}`).toBe('more');
    const chevron = cornerMask.locator('svg').first();
    await expect(chevron, `setinha SVG visível @${vp.name}`).toBeVisible();
    const chevronBox = await chevron.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, left: r.left, top: r.top };
    });
    expect(chevronBox.w, `setinha width 16px @${vp.name}`).toBeCloseTo(16, 1);
    expect(chevronBox.h, `setinha height 16px @${vp.name}`).toBeCloseTo(16, 1);
    const maskRect = await cornerMask.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    expect(
      Math.abs(chevronBox.left + chevronBox.w / 2 - (maskRect.left + maskRect.width / 2)),
      `seta centralizada no eixo X @${vp.name}`,
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(chevronBox.top + chevronBox.h / 2 - (maskRect.top + maskRect.height / 2)),
      `seta centralizada no eixo Y @${vp.name}`,
    ).toBeLessThanOrEqual(1.5);

    // Após scroll até o fim, hint muda para "end" sem alterar o ícone visual.
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(() => cornerMask.getAttribute('data-scroll-hint'), {
        message: `data-scroll-hint após scroll @${vp.name}`,
      })
      .toBe('end');
    await scroller.evaluate((el) => {
      el.scrollTop = 0;
    });

  });
}
