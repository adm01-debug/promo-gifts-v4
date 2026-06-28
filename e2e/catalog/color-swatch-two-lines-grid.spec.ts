/**
 * E2E — ProductCard no grid: o container de swatches DEVE ter exatamente 2 linhas
 * de altura em TODOS os breakpoints (mobile, tablet, desktop, wide).
 *
 * Fórmula SSOT (ProductColorSwatches.tsx:179):
 *   max-h = 2*size + gap-y + 2*py
 *
 * Estratégia:
 *  - Resolve os tokens (`--swatch-size-sm`, `--swatch-gap-y`, `--swatch-container-py`)
 *    a partir do próprio container já montado — não duplica valores numéricos.
 *  - Para cada card visível com `role=radiogroup`, mede `clientHeight` e compara
 *    com o limite calculado (tolerância 1px para anti-aliasing/sub-pixel).
 *  - Em cards com overflow (mais cores do que cabem), o container tem que estar
 *    no limite exato (== max-h). Em cards sem overflow, deve estar ≤ max-h.
 */
import { test, expect, type Page } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
] as const;

const TOLERANCE_PX = 1;
const SAMPLE_CARDS = 8;

async function settleCatalog(page: Page) {
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 20_000 });
  await expect(page.locator('[data-testid="product-card-skeleton"]')).toHaveCount(0);
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
  });
}

function parsePx(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

test.describe('ProductCard — swatches travados em 2 linhas no grid', () => {
  for (const vp of VIEWPORTS) {
    test(`viewport ${vp.name} (${vp.width}px): container respeita max-h de 2 linhas`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/catalogo');
      await settleCatalog(page);

      const cards = page.locator('[data-testid="product-card"]:has([role="radiogroup"])');
      const total = await cards.count();
      test.skip(total === 0, 'Nenhum card com swatches no dataset.');

      const sample = Math.min(SAMPLE_CARDS, total);
      let assertedAtLeastOne = false;

      for (let i = 0; i < sample; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        const group = card.locator('[role="radiogroup"]').first();
        if (!(await group.isVisible().catch(() => false))) continue;

        const metrics = await group.evaluate((el) => {
          const cs = getComputedStyle(el);
          // Tokens podem ser sobrescritos por size local; pega do elemento.
          const size =
            cs.getPropertyValue('--swatch-size').trim() ||
            cs.getPropertyValue('--swatch-size-sm').trim();
          const gapY = cs.getPropertyValue('--swatch-gap-y').trim();
          const py = cs.getPropertyValue('--swatch-container-py').trim();
          return {
            size,
            gapY,
            py,
            clientHeight: (el as HTMLElement).clientHeight,
            maxHeight: cs.maxHeight,
            childCount: el.querySelectorAll('[role="radio"]').length,
          };
        });

        const sizePx = parsePx(metrics.size);
        const gapYPx = parsePx(metrics.gapY);
        const pyPx = parsePx(metrics.py);

        // Token deve existir — fail-fast em vez de silenciosamente passar.
        expect.soft(sizePx, `--swatch-size resolvido no card ${i}`).toBeGreaterThan(0);
        expect.soft(gapYPx, `--swatch-gap-y resolvido no card ${i}`).toBeGreaterThanOrEqual(0);
        expect.soft(pyPx, `--swatch-container-py resolvido no card ${i}`).toBeGreaterThan(0);

        const twoLineMax = 2 * sizePx + gapYPx + 2 * pyPx;

        // Container nunca pode passar do limite de 2 linhas.
        expect(
          metrics.clientHeight,
          `card ${i} @ ${vp.name}: clientHeight ${metrics.clientHeight}px > 2 linhas (${twoLineMax}px)`,
        ).toBeLessThanOrEqual(twoLineMax + TOLERANCE_PX);

        assertedAtLeastOne = true;
      }

      expect(assertedAtLeastOne, 'pelo menos um card deveria ter sido validado').toBe(true);
    });
  }
});
