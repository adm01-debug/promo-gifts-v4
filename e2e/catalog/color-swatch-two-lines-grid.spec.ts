/**
 * E2E — ProductCard no grid: o container de swatches DEVE ter exatamente 2 linhas
 * de altura em TODOS os breakpoints (mobile, tablet, desktop, wide).
 *
 * Fórmula SSOT (ProductColorSwatches.tsx:179):
 *   max-h = 2*size + gap-y + 2*py
 *
 * Cobre:
 *  1) Altura ≤ 2 linhas em qualquer card visível (todos os breakpoints).
 *  2) Cards com overflow → chip "+N" aparece e visíveis+ocultas = total.
 *  3) Estados sem clipping: idle, hover do card, focus do swatch, selected.
 *  4) Screenshot do container por breakpoint (artefato de revisão).
 */
import { test, expect, type Page, type Locator } from '../fixtures/test-base';
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

async function measureGroup(group: Locator) {
  return group.evaluate((el) => {
    const cs = getComputedStyle(el);
    const size =
      cs.getPropertyValue('--swatch-size').trim() ||
      cs.getPropertyValue('--swatch-size-sm').trim();
    return {
      sizePx: parseFloat(size) || 0,
      gapYPx: parseFloat(cs.getPropertyValue('--swatch-gap-y').trim()) || 0,
      pyPx: parseFloat(cs.getPropertyValue('--swatch-container-py').trim()) || 0,
      clientHeight: (el as HTMLElement).clientHeight,
      scrollHeight: (el as HTMLElement).scrollHeight,
    };
  });
}

async function assertSwatchInsideGroup(group: Locator, swatch: Locator, label: string) {
  const [g, s] = await Promise.all([group.boundingBox(), swatch.boundingBox()]);
  expect(g, `${label}: radiogroup bbox`).not.toBeNull();
  expect(s, `${label}: swatch bbox`).not.toBeNull();
  if (!g || !s) return;
  expect(s.y, `${label}: top sem clipping`).toBeGreaterThanOrEqual(g.y - TOLERANCE_PX);
  expect(s.y + s.height, `${label}: bottom sem clipping`).toBeLessThanOrEqual(
    g.y + g.height + TOLERANCE_PX,
  );
}

test.describe('ProductCard — swatches travados em 2 linhas no grid', () => {
  for (const vp of VIEWPORTS) {
    test(`viewport ${vp.name} (${vp.width}px): 2 linhas + chip +N + sem clipping`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/catalogo');
      await settleCatalog(page);

      const cards = page.locator('[data-testid="product-card"]:has([role="radiogroup"])');
      const total = await cards.count();
      test.skip(total === 0, 'Nenhum card com swatches no dataset.');

      const sample = Math.min(SAMPLE_CARDS, total);
      let heightAsserted = 0;
      let overflowAsserted = 0;
      let firstGroupShot = false;

      for (let i = 0; i < sample; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        const group = card.locator('[role="radiogroup"]').first();
        if (!(await group.isVisible().catch(() => false))) continue;

        // (1) altura nunca passa de 2 linhas
        const m = await measureGroup(group);
        expect.soft(m.sizePx, `card ${i}: --swatch-size`).toBeGreaterThan(0);
        const twoLineMax = 2 * m.sizePx + m.gapYPx + 2 * m.pyPx;
        expect(
          m.clientHeight,
          `card ${i} @ ${vp.name}: ${m.clientHeight}px > 2 linhas (${twoLineMax}px)`,
        ).toBeLessThanOrEqual(twoLineMax + TOLERANCE_PX);
        heightAsserted++;

        // Screenshot do primeiro grupo visível em cada breakpoint (revisão visual).
        if (!firstGroupShot) {
          const shot = await group.screenshot();
          await testInfo.attach(`swatches-${vp.name}.png`, {
            body: shot,
            contentType: 'image/png',
          });
          firstGroupShot = true;
        }

        // (2) overflow: chip "+N" presente e visíveis + hidden = total
        const chip = card.locator('[data-testid="color-swatches-overflow"]').first();
        if (await chip.isVisible().catch(() => false)) {
          const ariaLabel = (await chip.getAttribute('aria-label')) ?? '';
          const declaredTotal = Number(ariaLabel.match(/(\d+)\s+cores?/i)?.[1] ?? '0');
          const hidden = Number(ariaLabel.match(/\+?(\d+)/)?.[1] ?? '0');
          const visible = await group.locator('[role="radio"]').count();
          if (declaredTotal > 0) {
            expect(
              visible + hidden,
              `card ${i}: visíveis(${visible}) + ocultas(${hidden}) ≠ total(${declaredTotal})`,
            ).toBe(declaredTotal);
            overflowAsserted++;
          }
        }

        // (3) estados sem clipping
        const first = group.locator('[role="radio"]').first();
        if (!(await first.count())) continue;

        await card.hover();
        await assertSwatchInsideGroup(group, first, `card ${i} hover`);

        await first.focus();
        await assertSwatchInsideGroup(group, first, `card ${i} focus`);

        await first.click({ force: true });
        await expect(first).toHaveAttribute('aria-checked', 'true');
        await assertSwatchInsideGroup(group, first, `card ${i} selected`);
      }

      expect(heightAsserted, 'pelo menos 1 card validado por altura').toBeGreaterThan(0);
      testInfo.annotations.push({
        type: 'coverage',
        description: `${vp.name}: altura=${heightAsserted}, overflow=${overflowAsserted}`,
      });
    });
  }
});
