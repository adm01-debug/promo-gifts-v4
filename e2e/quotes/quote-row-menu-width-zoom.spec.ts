/**
 * Valida o DropdownMenuContent das linhas de orçamento sob zoom de 125%
 * (browser-level via CSS zoom no <html>), garantindo:
 *  - min-width permanece 0
 *  - "Histórico" não é cortado (scrollWidth ≤ clientWidth + 1)
 *  - Ao hover/focus do item "Histórico", o menu mantém width = 6.4rem
 *    (proporção real; aceita o multiplicador de zoom) sem overflow.
 *
 * Cobre desktop (1280) e mobile (390).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos';
const ZOOM = 1.25;
const BASE_WIDTH_REM = 6.4;
const BASE_WIDTH_PX = BASE_WIDTH_REM * 16; // 102.4

test.use({ reducedMotion: 'reduce' });

async function applyZoom(page: Page, factor: number) {
  await page.addStyleTag({ content: `html { zoom: ${factor}; }` });
}

async function openMenu(page: Page) {
  await gotoAndSettle(page, ROUTE);
  const trigger = page.locator('[aria-haspopup="menu"]').first();
  if ((await trigger.count()) === 0) {
    test.skip(true, 'lista vazia — sem trigger de menu disponível');
  }
  await trigger.click();
  const content = page.locator('[data-testid^="quote-row-menu-"][role="menu"]').first();
  await expect(content).toBeVisible();
  return content;
}

for (const vp of [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  test.describe(`quote row menu @ zoom 125% (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('min-width=0, Histórico não corta, hover/focus mantém width', async ({ page }) => {
      await page.goto('/');
      await applyZoom(page, ZOOM);

      const content = await openMenu(page);

      // 1. computed styles — min-width permanece 0 sob zoom.
      const cs = await content.evaluate((el) => {
        const c = getComputedStyle(el as HTMLElement);
        return { width: c.width, minWidth: c.minWidth };
      });
      expect(parseFloat(cs.minWidth)).toBe(0);
      // width nominal computada permanece 6.4rem (zoom não muda computed style,
      // apenas o layout final). Tolerância 0.5px.
      expect(parseFloat(cs.width)).toBeGreaterThanOrEqual(BASE_WIDTH_PX - 0.5);
      expect(parseFloat(cs.width)).toBeLessThanOrEqual(BASE_WIDTH_PX + 0.5);

      // 2. Histórico cabe sem corte.
      const historico = content.locator('[role="menuitem"]', { hasText: /hist/i }).first();
      await expect(historico).toBeVisible();
      const cut = await historico.evaluate((el) => {
        const h = el as HTMLElement;
        return { scrollW: h.scrollWidth, clientW: h.clientWidth };
      });
      expect(cut.scrollW - cut.clientW).toBeLessThanOrEqual(1);

      // 3. Hover + focus mantêm width do menu (proporção real, considerando zoom).
      const baseBox = await content.boundingBox();
      expect(baseBox).toBeTruthy();

      await historico.hover();
      const hoverBox = await content.boundingBox();
      expect(hoverBox).toBeTruthy();
      expect(Math.abs(hoverBox!.width - baseBox!.width)).toBeLessThanOrEqual(0.5);

      await historico.focus();
      const focusBox = await content.boundingBox();
      expect(focusBox).toBeTruthy();
      expect(Math.abs(focusBox!.width - baseBox!.width)).toBeLessThanOrEqual(0.5);

      // largura real ≈ 6.4rem * zoom (102.4 * 1.25 = 128)
      const expectedRendered = BASE_WIDTH_PX * ZOOM;
      expect(focusBox!.width).toBeGreaterThanOrEqual(expectedRendered - 2);
      expect(focusBox!.width).toBeLessThanOrEqual(expectedRendered + 2);

      // sem overflow horizontal do viewport.
      expect(focusBox!.x + focusBox!.width).toBeLessThanOrEqual(vp.width + 1);
    });
  });
}
