/**
 * Garante que o DropdownMenuContent das linhas de orçamento aplica width=6.4rem
 * e min-width=0 (20% menor que o baseline 8rem do shadcn), em desktop e mobile,
 * sem corte de "Histórico".
 *
 * Cobertura:
 *  1. computed styles (width, min-width)
 *  2. bounding box ≤ viewport (sem overflow horizontal)
 *  3. cada [role="menuitem"] com whiteSpace=nowrap e scrollWidth ≤ clientWidth+1
 *  4. screenshot visual por viewport
 *
 * Baselines:
 *   npx playwright test e2e/quotes/quote-row-menu-width.spec.ts \
 *     --project=chromium-public --update-snapshots
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos';

const SNAP = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.02,
  threshold: 0.2,
  scale: 'css' as const,
};

const EXPECTED_WIDTH_PX = 6.4 * 16; // 102.4

test.use({ reducedMotion: 'reduce' });

async function openFirstRowMenu(page: Page) {
  await gotoAndSettle(page, ROUTE);
  const trigger = page.locator('[aria-haspopup="menu"]').first();
  if ((await trigger.count()) === 0) {
    test.skip(true, 'lista vazia — sem trigger de menu disponível');
  }
  await trigger.click();
  const content = page.locator('[data-testid^="quote-row-menu-"][role="menu"]').first();
  await expect(content).toBeVisible();
  await page.evaluate(
    () =>
      document.fonts &&
      (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready,
  );
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  return content;
}

for (const vp of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test.describe(`@visual quote row menu width @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('computed styles + Histórico cabe + snapshot', async ({ page }) => {
      const content = await openFirstRowMenu(page);

      const cs = await content.evaluate((el) => {
        const c = getComputedStyle(el as HTMLElement);
        return { width: c.width, minWidth: c.minWidth, maxWidth: c.maxWidth };
      });
      // width fixo em 6.4rem (102.4px) — tolerância de 0.5px para subpixel.
      expect(parseFloat(cs.width)).toBeGreaterThanOrEqual(EXPECTED_WIDTH_PX - 0.5);
      expect(parseFloat(cs.width)).toBeLessThanOrEqual(EXPECTED_WIDTH_PX + 0.5);
      expect(parseFloat(cs.minWidth)).toBe(0);

      const box = await content.boundingBox();
      expect(box, 'menu sem bounding box').toBeTruthy();
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);

      const items = content.locator('[role="menuitem"]');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const it = items.nth(i);
        const info = await it.evaluate((el) => ({
          ws: getComputedStyle(el).whiteSpace,
          scrollW: (el as HTMLElement).scrollWidth,
          clientW: (el as HTMLElement).clientWidth,
          text: el.textContent?.trim() ?? '',
        }));
        expect(info.ws, `item "${info.text}" precisa ser nowrap`).toMatch(/nowrap/);
        expect(
          info.scrollW - info.clientW,
          `item "${info.text}" está sendo cortado (${info.scrollW}>${info.clientW})`,
        ).toBeLessThanOrEqual(1);
      }

      await expect(content).toHaveScreenshot(`quote-row-menu-${vp.name}.png`, SNAP);
    });
  });
}
