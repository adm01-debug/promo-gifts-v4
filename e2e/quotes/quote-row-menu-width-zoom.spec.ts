/**
 * Valida o DropdownMenuContent das linhas de orçamento sob zoom 125%.
 * Roda no project `chromium-authed` (storageState gerado por auth.setup),
 * que abre `/orcamentos` autenticado com dados reais — sem fallback para /auth.
 *
 * Asserts emitem evidência (width, min-width, scrollWidth/clientWidth, box).
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos';
const ZOOM = 1.25;
const BASE_WIDTH_PX = 6.4 * 16; // 102.4

test.use({ reducedMotion: 'reduce' });

async function snapshotMenu(content: Locator, label: string) {
  const data = await content.evaluate((el) => {
    const c = getComputedStyle(el as HTMLElement);
    const h = el as HTMLElement;
    const r = h.getBoundingClientRect();
    return {
      width: c.width,
      minWidth: c.minWidth,
      maxWidth: c.maxWidth,
      boxWidth: r.width,
      boxX: r.x,
      scrollW: h.scrollWidth,
      clientW: h.clientWidth,
    };
  });
  return { label, ...data };
}

function fmt(s: Awaited<ReturnType<typeof snapshotMenu>>, vpName: string, vpWidth: number) {
  return (
    `[${s.label}] vp=${vpName}(${vpWidth}px) zoom=${ZOOM} ` +
    `width=${s.width} minWidth=${s.minWidth} maxWidth=${s.maxWidth} ` +
    `box.width=${s.boxWidth.toFixed(2)} box.x=${s.boxX.toFixed(2)} ` +
    `scrollW=${s.scrollW} clientW=${s.clientW} overflow=${s.scrollW - s.clientW}`
  );
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
      await page.addStyleTag({ content: `html { zoom: ${ZOOM}; }` });

      const content = await openMenu(page);
      const base = await snapshotMenu(content, 'idle');

      expect(
        parseFloat(base.minWidth),
        `min-width deveria ser 0 sob zoom ${ZOOM}.\n${fmt(base, vp.name, vp.width)}`,
      ).toBe(0);
      expect(
        parseFloat(base.width),
        `computed width deveria ser ~${BASE_WIDTH_PX}px.\n${fmt(base, vp.name, vp.width)}`,
      ).toBeGreaterThanOrEqual(BASE_WIDTH_PX - 0.5);
      expect(parseFloat(base.width)).toBeLessThanOrEqual(BASE_WIDTH_PX + 0.5);

      const historico = content.locator('[role="menuitem"]', { hasText: /hist/i }).first();
      await expect(historico, '"Histórico" não foi renderizado').toBeVisible();

      const itemInfo = await historico.evaluate((el) => {
        const h = el as HTMLElement;
        return { scrollW: h.scrollWidth, clientW: h.clientWidth, ws: getComputedStyle(h).whiteSpace };
      });
      expect(
        itemInfo.scrollW - itemInfo.clientW,
        `"Histórico" cortado: scrollW=${itemInfo.scrollW} clientW=${itemInfo.clientW} ws=${itemInfo.ws}`,
      ).toBeLessThanOrEqual(1);

      await historico.hover();
      const hover = await snapshotMenu(content, 'hover');
      await historico.focus();
      const focus = await snapshotMenu(content, 'focus');

      expect(
        Math.abs(hover.boxWidth - base.boxWidth),
        `width mudou no hover.\n${fmt(base, vp.name, vp.width)}\n${fmt(hover, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(focus.boxWidth - base.boxWidth),
        `width mudou no focus.\n${fmt(base, vp.name, vp.width)}\n${fmt(focus, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(0.5);

      // Largura renderizada ≈ 6.4rem * zoom = 128px
      const expectedRendered = BASE_WIDTH_PX * ZOOM;
      expect(
        focus.boxWidth,
        `box width fora do esperado sob zoom.\n${fmt(focus, vp.name, vp.width)}`,
      ).toBeGreaterThanOrEqual(expectedRendered - 2);
      expect(focus.boxWidth).toBeLessThanOrEqual(expectedRendered + 2);

      expect(
        focus.boxX + focus.boxWidth,
        `menu transbordou viewport.\n${fmt(focus, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(vp.width + 1);
    });
  });
}
