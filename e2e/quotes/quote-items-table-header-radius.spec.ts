/**
 * QuoteItemsTable · header fora do scroller + alinhamento de colunas + a11y.
 *
 * Cobertura em 390 / 768 / 1280 × 2 fixtures (5 colunas sem scroll interno
 * e 6 colunas com scroll interno e personalização):
 *  - Wrapper preserva os 4 cantos arredondados e overflow:hidden.
 *  - `<thead>` NÃO pertence ao scroller (scroll começa abaixo do header);
 *    `<tbody>` pertence; `cornerMask` legado não existe mais.
 *  - 1ª `<th>` TL > 0 e última `<th>` TR > 0 (sem pixel preto na borda azul).
 *  - Colunas header ↔ body alinhadas (Δ ≤ 2px) no início, no meio e no fim
 *    do scroll vertical.
 *  - `data-scrollbar-pad` reflete a medida runtime (`offsetWidth - clientWidth`)
 *    e mantém colunas alinhadas em ambientes com scrollbar overlay (=0) e
 *    clássica (>0).
 *  - A11y: cada `<td>` referencia o `<th id>` correspondente via `headers`,
 *    garantindo leitura "Coluna: valor" em leitores de tela mesmo com
 *    thead/tbody em <table>s distintas.
 *  - Documento não estoura horizontalmente em nenhum breakpoint.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;
const FIXTURES = [
  { id: 'quote-items-table-fixture', label: 'with-personalization' },
  { id: 'quote-items-table-fixture-many', label: 'many-rows-inner-scroll' },
] as const;

const MIN_RADIUS_PX = 2;
const ALIGN_TOLERANCE_PX = 2;

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

const px = (v: string) => Number.parseFloat(v) || 0;

async function measureAlignment(scope: ReturnType<Page['getByTestId']>) {
  return scope.evaluate((fx) => {
    const ths = [
      ...fx.querySelectorAll<HTMLTableCellElement>(
        '[data-testid="quote-items-table-header-wrap"] thead tr > th',
      ),
    ];
    const tr = fx.querySelector<HTMLTableRowElement>(
      '[data-testid="quote-items-table-scroll"] tbody tr:not([class*="bg-accent"]):not([class*="bg-muted/30"])',
    );
    const tds = tr ? [...tr.querySelectorAll<HTMLTableCellElement>('td')] : [];
    return ths.map((th, i) => {
      const a = th.getBoundingClientRect();
      const b = tds[i]?.getBoundingClientRect();
      return {
        i,
        thId: th.id,
        tdHeaders: tds[i]?.getAttribute('headers') ?? null,
        dLeft: b ? Number((b.left - a.left).toFixed(2)) : null,
        dRight: b ? Number((b.right - a.right).toFixed(2)) : null,
        dWidth: b ? Number((b.width - a.width).toFixed(2)) : null,
      };
    });
  });
}

for (const vp of VIEWPORTS) {
  for (const fx of FIXTURES) {
    test(`[${vp.name}/${fx.label}] header fora do scroller, colunas alinhadas e a11y`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);

      const fixture = page.getByTestId(fx.id);
      const wrapper = fixture.getByTestId('quote-items-table-wrapper');
      const headerWrap = fixture.getByTestId('quote-items-table-header-wrap');
      const scroller = fixture.getByTestId('quote-items-table-scroll');
      await expect(wrapper).toBeVisible();
      await expect(headerWrap).toBeVisible();
      await expect(scroller).toBeVisible();

      // ── Wrapper: 4 cantos arredondados + overflow:hidden.
      const w = await wrapper.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          tl: cs.borderTopLeftRadius,
          tr: cs.borderTopRightRadius,
          bl: cs.borderBottomLeftRadius,
          br: cs.borderBottomRightRadius,
          ox: cs.overflowX,
          oy: cs.overflowY,
        };
      });
      for (const k of ['tl', 'tr', 'bl', 'br'] as const) {
        expect(px(w[k]), `wrapper ${k} @${vp.name}/${fx.label}`).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
      }
      expect(w.ox).toBe('hidden');
      expect(w.oy).toBe('hidden');

      // ── Documento não estoura horizontalmente.
      const dm = await page.evaluate(() => ({
        d: document.documentElement.scrollWidth,
        v: window.innerWidth,
      }));
      expect(dm.d).toBeLessThanOrEqual(dm.v + 2);

      // ── Topologia DOM: header fora do scroller, tbody dentro, sem cornerMask.
      const topo = await fixture.evaluate((el) => {
        const sc = el.querySelector('[data-testid="quote-items-table-scroll"]');
        const hw = el.querySelector('[data-testid="quote-items-table-header-wrap"]');
        const thead = el.querySelector('thead');
        const tbody = el.querySelector('tbody');
        return {
          theadInScroller: !!(sc && thead && sc.contains(thead)),
          tbodyInScroller: !!(sc && tbody && sc.contains(tbody)),
          theadInHeaderWrap: !!(hw && thead && hw.contains(thead)),
          cornerMaskCount: el.querySelectorAll('[data-testid="quote-items-table-scrollbar-corner-mask"]').length,
        };
      });
      expect(topo.theadInScroller).toBe(false);
      expect(topo.tbodyInScroller).toBe(true);
      expect(topo.theadInHeaderWrap).toBe(true);
      expect(topo.cornerMaskCount).toBe(0);

      // ── Cantos do header (regressão visual contra pixel preto na borda).
      const ths = headerWrap.locator('thead tr > th');
      const thCount = await ths.count();
      expect(thCount).toBeGreaterThan(1);
      const firstTl = await ths.first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
      const lastTr = await ths.nth(thCount - 1).evaluate((el) => getComputedStyle(el).borderTopRightRadius);
      expect(px(firstTl)).toBeGreaterThanOrEqual(MIN_RADIUS_PX);
      expect(px(lastTr)).toBeGreaterThanOrEqual(MIN_RADIUS_PX);

      // ── A11y: cada <th> tem id e cada <td> da 1ª linha referencia via headers.
      const align0 = await measureAlignment(fixture);
      for (const a of align0) {
        expect(a.thId, `th[${a.i}] precisa de id @${vp.name}/${fx.label}`).toBeTruthy();
        expect(a.tdHeaders, `td[${a.i}] headers @${vp.name}/${fx.label}`).toBe(a.thId);
      }

      // ── Alinhamento header ↔ body no estado inicial.
      for (const a of align0) {
        expect(Math.abs(a.dLeft ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
        expect(Math.abs(a.dRight ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
        expect(Math.abs(a.dWidth ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
      }

      // ── data-scrollbar-pad runtime: número >= 0; em scrollbar overlay = 0,
      // em scrollbar clássica > 0 (caso o body role verticalmente).
      const padAttr = await headerWrap.getAttribute('data-scrollbar-pad');
      const padNum = Number(padAttr);
      expect(Number.isFinite(padNum)).toBe(true);
      expect(padNum).toBeGreaterThanOrEqual(0);
      const scrollMetrics = await scroller.evaluate((el) => ({
        offsetWidth: el.offsetWidth,
        clientWidth: el.clientWidth,
        canScrollY: el.scrollHeight > el.clientHeight + 1,
      }));
      const expectedPad = Math.max(0, scrollMetrics.offsetWidth - scrollMetrics.clientWidth);
      expect(
        Math.abs(padNum - expectedPad),
        `data-scrollbar-pad (${padNum}) ≈ offsetWidth-clientWidth (${expectedPad})`,
      ).toBeLessThanOrEqual(1);

      // ── Header não se move ao rolar verticalmente (constância de top).
      const headTop0 = await headerWrap.locator('thead').evaluate((el) => el.getBoundingClientRect().top);

      if (scrollMetrics.canScrollY) {
        // Meio do scroll.
        await scroller.evaluate((el) => {
          el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2);
        });
        await page.waitForTimeout(120);
        const headTopMid = await headerWrap.locator('thead').evaluate((el) => el.getBoundingClientRect().top);
        expect(Math.abs(headTopMid - headTop0)).toBeLessThanOrEqual(1);
        const alignMid = await measureAlignment(fixture);
        for (const a of alignMid) {
          expect(Math.abs(a.dLeft ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
          expect(Math.abs(a.dWidth ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
        }

        // Fim do scroll.
        await scroller.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(120);
        const headTopEnd = await headerWrap.locator('thead').evaluate((el) => el.getBoundingClientRect().top);
        expect(Math.abs(headTopEnd - headTop0)).toBeLessThanOrEqual(1);
        const alignEnd = await measureAlignment(fixture);
        for (const a of alignEnd) {
          expect(Math.abs(a.dLeft ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
          expect(Math.abs(a.dWidth ?? 0)).toBeLessThanOrEqual(ALIGN_TOLERANCE_PX);
        }
        await scroller.evaluate((el) => {
          el.scrollTop = 0;
        });
      }

      // ── A11y: header é navegável (scope=col em todas as colunas).
      const scopes = await ths.evaluateAll((els) => els.map((e) => e.getAttribute('scope')));
      for (const s of scopes) expect(s).toBe('col');
    });
  }
}

test('debug telemetry (window.__DEBUG_QUOTE_TABLE) emite scrollbarPad', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __DEBUG_QUOTE_TABLE?: boolean }).__DEBUG_QUOTE_TABLE = true;
  });
  const debugLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'debug' && msg.text().includes('[QuoteItemsTable] scrollbarPad')) {
      debugLogs.push(msg.text());
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await expect(page.getByTestId('quote-items-table-fixture-many')).toBeVisible();
  await page.waitForTimeout(300);
  expect(debugLogs.length, 'pelo menos 1 log de debug emitido').toBeGreaterThan(0);
});
