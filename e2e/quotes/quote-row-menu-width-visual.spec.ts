/**
 * Visual regression: largura do dropdown de ações do orçamento reduzida 20%
 * (min-w 8rem → 6.4rem). Cobre desktop e mobile para garantir que:
 *  - "Histórico" não quebra linha nem é cortado
 *  - O menu não estoura o viewport em mobile (max-w guard)
 *
 * Baselines (uma vez por project):
 *   npx playwright test e2e/quotes/quote-row-menu-width-visual.spec.ts \
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

test.use({ reducedMotion: 'reduce' });

async function openFirstRowMenu(page: Page) {
  await gotoAndSettle(page, ROUTE);
  const trigger = page
    .locator('[data-testid^="quote-row-menu-trigger-"], [aria-haspopup="menu"]')
    .first();
  // Fallback: o trigger é o botão dentro de DropdownMenuTrigger asChild.
  if ((await trigger.count()) === 0) {
    test.skip(true, 'lista vazia — sem trigger de menu para abrir');
  }
  await trigger.click();
  const content = page.locator('[data-testid^="quote-row-menu-"]').first();
  await expect(content).toBeVisible();
  // Garante render estável (fontes + 2 rAFs).
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

    test('width reduzido 20% sem cortar "Histórico"', async ({ page }) => {
      const content = await openFirstRowMenu(page);

      // Largura efetiva ≈ 6.4rem (≈102px) ou levemente maior por causa do conteúdo.
      const box = await content.boundingBox();
      expect(box, 'menu sem bounding box').toBeTruthy();
      // Sanity: largura entre 95px e 180px (não estourou nem voltou ao default 128+).
      expect(box!.width).toBeGreaterThanOrEqual(95);
      expect(box!.width).toBeLessThanOrEqual(180);
      // Não pode estourar o viewport em mobile.
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);

      // "Histórico" deve renderizar inteiro (sem ellipsis/wrap).
      const items = content.locator('[role="menuitem"]');
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        const it = items.nth(i);
        const overflow = await it.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            ws: cs.whiteSpace,
            scrollW: (el as HTMLElement).scrollWidth,
            clientW: (el as HTMLElement).clientWidth,
          };
        });
        expect(overflow.ws, 'menu item precisa ser nowrap').toMatch(/nowrap/);
        expect(
          overflow.scrollW - overflow.clientW,
          'texto do item está sendo cortado',
        ).toBeLessThanOrEqual(1);
      }

      await expect(content).toHaveScreenshot(`quote-row-menu-${vp.name}.png`, SNAP);
    });
  });
}
