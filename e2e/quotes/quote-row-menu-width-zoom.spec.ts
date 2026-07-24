/**
 * Valida o DropdownMenuContent das linhas de orçamento sob zoom de 125%
 * (browser-level via CSS zoom no <html>), garantindo:
 *  - min-width permanece 0
 *  - "Visualizar" (item mais longo, sempre habilitado) não é cortado
 *    (scrollWidth ≤ clientWidth + 1), inclusive sob focus:font-bold
 *  - Ao hover/focus de "Visualizar", o menu mantém width nominal = 6.8rem
 *    (a largura renderizada ≈ 6.8rem * zoom) sem overflow do viewport.
 *
 * Itens reais: Visualizar / Editar / Duplicar / Excluir. NÃO existe "Histórico".
 *
 * O zoom é aplicado APÓS navegar para a rota e ANTES de abrir o menu: como
 * `addStyleTag` injeta no documento corrente, aplicá-lo antes de navegar faria
 * o estilo ser descartado na navegação (zoom não chegaria à página do menu).
 *
 * Asserts emitem evidência (width, min-width, scrollWidth/clientWidth, box).
 * Cobre desktop (1280) e mobile (390).
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos';
const ZOOM = 1.25;
const BASE_WIDTH_PX = 6.8 * 16; // 108.8

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

async function openZoomedMenu(page: Page, zoom: number): Promise<Locator> {
  await gotoAndSettle(page, ROUTE);
  const trigger = page.locator('[aria-haspopup="menu"]').first();
  if ((await trigger.count()) === 0) {
    test.skip(true, 'lista vazia — sem trigger de menu disponível');
  }
  // zoom aplicado no documento já navegado, antes de abrir o menu.
  await page.addStyleTag({ content: `html { zoom: ${zoom}; }` });
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

    test('min-width=0, "Visualizar" não corta, hover/focus mantém width', async ({ page }) => {
      const content = await openZoomedMenu(page, ZOOM);
      const base = await snapshotMenu(content, 'idle');

      // min-width permanece 0; width nominal 6.8rem (CSS zoom não altera a computed
      // width, apenas o layout renderizado).
      expect(
        parseFloat(base.minWidth),
        `min-width deveria ser 0 sob zoom ${ZOOM}.\n${fmt(base, vp.name, vp.width)}`,
      ).toBe(0);
      expect(
        parseFloat(base.width),
        `computed width deveria ser ~${BASE_WIDTH_PX}px.\n${fmt(base, vp.name, vp.width)}`,
      ).toBeGreaterThanOrEqual(BASE_WIDTH_PX - 0.5);
      expect(parseFloat(base.width)).toBeLessThanOrEqual(BASE_WIDTH_PX + 0.5);

      // "Visualizar" cabe sem corte (repouso).
      const view = content.locator('[data-testid^="quote-row-menu-view-"]').first();
      await expect(view, '"Visualizar" não foi renderizado').toBeVisible();
      const cut = await view.evaluate((el) => {
        const h = el as HTMLElement;
        return { scrollW: h.scrollWidth, clientW: h.clientWidth, ws: getComputedStyle(h).whiteSpace };
      });
      expect(
        cut.scrollW - cut.clientW,
        `"Visualizar" cortado: scrollW=${cut.scrollW} clientW=${cut.clientW} ws=${cut.ws}`,
      ).toBeLessThanOrEqual(1);

      // Hover + focus mantêm a largura do menu (proporção real, com zoom).
      await view.hover();
      const hover = await snapshotMenu(content, 'hover');
      await view.focus();
      const focus = await snapshotMenu(content, 'focus');

      expect(
        Math.abs(hover.boxWidth - base.boxWidth),
        `width mudou no hover.\n${fmt(base, vp.name, vp.width)}\n${fmt(hover, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(focus.boxWidth - base.boxWidth),
        `width mudou no focus.\n${fmt(base, vp.name, vp.width)}\n${fmt(focus, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(0.5);

      // largura renderizada ≈ 6.8rem * zoom (108.8 * 1.25 = 136)
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

      // sob focus:font-bold (peso 700) "Visualizar" NÃO pode cortar.
      const focusedCut = await view.evaluate((el) => {
        const h = el as HTMLElement;
        return { scrollW: h.scrollWidth, clientW: h.clientWidth };
      });
      expect(
        focusedCut.scrollW - focusedCut.clientW,
        `"Visualizar" cortado sob focus:font-bold (${focusedCut.scrollW}>${focusedCut.clientW})`,
      ).toBeLessThanOrEqual(1);
    });
  });
}
