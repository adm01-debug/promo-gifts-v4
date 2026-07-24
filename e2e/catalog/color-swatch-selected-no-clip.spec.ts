/**
 * E2E — Garantia de NÃO clipping da bolinha SELECIONADA.
 *
 * Bug histórico: o container `role=radiogroup` tem `overflow-hidden` (necessário
 * para travar em 2 linhas). Ao selecionar, o swatch ganha scale(1.1) + ring 2px
 * + glow no ::after — se `--swatch-container-py` for menor que ring+scale+glow,
 * o topo/base da bolinha selecionada fica cortado.
 *
 * Estratégia: para cada card com swatches, clica o primeiro swatch e compara
 * o bounding box do <button> (que já inclui ring + scale aplicados pelo browser)
 * com o bounding box do <radiogroup>. Asserção: o swatch deve estar inteiramente
 * contido verticalmente no container (com tolerância de 0.5px por anti-aliasing).
 *
 * Cobre desktop + mobile, várias contagens de cores (cards sem e com overflow).
 */
import { test, expect, type Page, type Locator } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const TOLERANCE_PX = 0.5;
const SAMPLE_CARDS = 5;

async function settleCatalog(page: Page) {
  await page.waitForSelector('[data-testid="product-card"]', { timeout: 20_000 });
  await expect(page.locator('[data-testid="product-card-skeleton"]')).toHaveCount(0);
  await page.addStyleTag({
    content: `*, *::before, *::after { transition: none !important; animation: none !important; }`,
  });
}

async function assertSwatchNotClipped(group: Locator, swatch: Locator) {
  const [gBox, sBox] = await Promise.all([group.boundingBox(), swatch.boundingBox()]);
  expect(gBox, 'radiogroup deve ter bounding box').not.toBeNull();
  expect(sBox, 'swatch deve ter bounding box').not.toBeNull();
  if (!gBox || !sBox) return;

  // Vertical: swatch (incluindo ring/scale/glow renderizado) deve caber no container.
  expect(sBox.y).toBeGreaterThanOrEqual(gBox.y - TOLERANCE_PX);
  expect(sBox.y + sBox.height).toBeLessThanOrEqual(gBox.y + gBox.height + TOLERANCE_PX);
  // Horizontal: idem.
  expect(sBox.x).toBeGreaterThanOrEqual(gBox.x - TOLERANCE_PX);
  expect(sBox.x + sBox.width).toBeLessThanOrEqual(gBox.x + gBox.width + TOLERANCE_PX);
}

test.describe('ProductCard — swatch selecionado não é cortado', () => {
  for (const vp of VIEWPORTS) {
    test(`viewport ${vp.name}: nenhuma bolinha selecionada vaza do radiogroup`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/catalogo');
      await settleCatalog(page);

      const cards = page.locator('[data-testid="product-card"]:has([role="radiogroup"])');
      const total = await cards.count();
      test.skip(total === 0, 'Nenhum card com swatches no dataset.');

      const sample = Math.min(SAMPLE_CARDS, total);
      for (let i = 0; i < sample; i++) {
        const card = cards.nth(i);
        await card.scrollIntoViewIfNeeded();
        const group = card.locator('[role="radiogroup"]').first();
        const swatches = group.locator('[role="radio"]');
        const swatchCount = await swatches.count();
        if (swatchCount === 0) continue;

        // Clica a primeira bolinha → estado "selecionado" com ring + scale + glow.
        const target = swatches.first();
        await target.click({ force: true });
        await expect(target).toHaveAttribute('aria-checked', 'true');

        await assertSwatchNotClipped(group, target);

        // Também valida última bolinha visível (canto direito tende a clipar primeiro).
        const last = swatches.nth(swatchCount - 1);
        await last.click({ force: true });
        await expect(last).toHaveAttribute('aria-checked', 'true');
        await assertSwatchNotClipped(group, last);
      }
    });
  }
});
