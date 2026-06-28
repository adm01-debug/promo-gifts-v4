/**
 * Garante que o DropdownMenuContent das linhas de orçamento aplica width=6.8rem
 * e min-width=0 (~15% menor que o baseline 8rem do shadcn), em desktop e mobile,
 * sem corte do item mais longo ("Visualizar"), inclusive sob focus:font-bold.
 *
 * Itens reais do menu: Visualizar / Editar / Duplicar / Excluir (testids estáveis
 * `quote-row-menu-{view,edit,duplicate,delete}-<id>`). NÃO existe "Histórico".
 *
 * 6.8rem é o mínimo à prova de corte: a 6.4rem o item "Visualizar" em peso 700
 * (focus:font-bold) estoura ~7px quando a fonte web (Plus Jakarta Sans) ainda não
 * carregou e o fallback system-ui está ativo (FOUT / Google Fonts bloqueado).
 *
 * Asserts emitem evidência (width, min-width, scrollWidth/clientWidth, box) em caso
 * de falha. Sem screenshot baseline — cobertura 100% determinística.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/orcamentos';
const EXPECTED_WIDTH_PX = 6.8 * 16; // 108.8

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
    `[${s.label}] vp=${vpName}(${vpWidth}px) ` +
    `width=${s.width} minWidth=${s.minWidth} maxWidth=${s.maxWidth} ` +
    `box.width=${s.boxWidth.toFixed(2)} box.x=${s.boxX.toFixed(2)} ` +
    `scrollW=${s.scrollW} clientW=${s.clientW} overflow=${s.scrollW - s.clientW}`
  );
}

async function openFirstRowMenu(page: Page): Promise<Locator> {
  await gotoAndSettle(page, ROUTE);
  const trigger = page.locator('[aria-haspopup="menu"]').first();
  if ((await trigger.count()) === 0) {
    test.skip(true, 'lista vazia — sem trigger de menu disponível');
  }
  await trigger.click();
  const content = page.locator('[data-testid^="quote-row-menu-"][role="menu"]').first();
  await expect(content).toBeVisible();
  // garante que a fonte web foi carregada antes de medir (evita FOUT no measure).
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

    test('computed styles + "Visualizar" cabe sob focus', async ({ page }) => {
      const content = await openFirstRowMenu(page);
      const base = await snapshotMenu(content, 'idle');

      // width fixo em 6.8rem (108.8px) — tolerância de 0.5px para subpixel.
      expect(
        parseFloat(base.width),
        `computed width deveria ser ~${EXPECTED_WIDTH_PX}px.\n${fmt(base, vp.name, vp.width)}`,
      ).toBeGreaterThanOrEqual(EXPECTED_WIDTH_PX - 0.5);
      expect(parseFloat(base.width)).toBeLessThanOrEqual(EXPECTED_WIDTH_PX + 0.5);
      expect(
        parseFloat(base.minWidth),
        `min-width deveria ser 0.\n${fmt(base, vp.name, vp.width)}`,
      ).toBe(0);
      expect(
        base.boxX + base.boxWidth,
        `menu transbordou viewport.\n${fmt(base, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(vp.width);

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

      // "Visualizar" é o item mais longo e sempre habilitado: hover + focus
      // (focus:font-bold → peso 700) não devem alterar a largura nem cortar o item.
      const view = content.locator('[data-testid^="quote-row-menu-view-"]').first();
      await expect(view, '"Visualizar" não foi renderizado').toBeVisible();

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
      expect(
        focus.boxX + focus.boxWidth,
        `menu transbordou viewport no focus.\n${fmt(focus, vp.name, vp.width)}`,
      ).toBeLessThanOrEqual(vp.width + 1);

      // no estado focado (peso 700) "Visualizar" NÃO pode cortar.
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
