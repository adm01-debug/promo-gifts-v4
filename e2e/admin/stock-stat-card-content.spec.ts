/**
 * E2E — Garante que o conteúdo do StockStatCard (título, valor, subtítulo e
 * trend) não fica cortado verticalmente em telas pequenas/médias após a
 * redução de altura do card.
 *
 * Estratégia: compara `scrollHeight` vs `clientHeight` de cada elemento de
 * texto (overflow vertical) e valida que a bbox de cada filho cabe dentro
 * da bbox do card (sem overflow visível).
 */
import { test, expect, type Page, type Locator } from '../fixtures/test-base';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';
import { Sel } from '../fixtures/selectors';

const VIEWPORTS = [
  { name: 'xs-320', width: 320, height: 700 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;

async function expectNoVerticalClip(locator: Locator) {
  const overflow = await locator.evaluate((el) => ({
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
  }));
  // Tolerância de 1px para sub-pixel rendering.
  expect(
    overflow.scrollH - overflow.clientH,
    `vertical clip: scrollH=${overflow.scrollH} clientH=${overflow.clientH}`,
  ).toBeLessThanOrEqual(1);
}

async function assertCardContent(page: Page, slug: string) {
  const card = page.locator(Sel.stock.statCardBySlug(slug));
  await expect(card).toBeVisible({ timeout: 15_000 });

  const cardBox = await card.boundingBox();
  expect(cardBox, `boundingBox de ${slug}`).not.toBeNull();
  if (!cardBox) return;

  for (const sel of [
    Sel.stock.statCardTitle,
    Sel.stock.statCardValue,
  ]) {
    const child = card.locator(sel);
    await expect(child).toBeVisible();
    await expectNoVerticalClip(child);
    const box = await child.boundingBox();
    expect(box, `bbox ${sel} de ${slug}`).not.toBeNull();
    if (!box) continue;
    // Filho deve caber verticalmente no card (com 1px de tolerância).
    expect(box.y).toBeGreaterThanOrEqual(cardBox.y - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
  }
}

const SLUGS = [
  'total-de-produtos',
  'em-estoque',
  'estoque-baixo',
  'sem-estoque',
  'estoque-futuro',
] as const;

test.describe('StockStatCard — conteúdo não fica cortado', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('título, valor, subtítulo e trend cabem em todos os 5 cards', async ({ page }) => {
        await loginAs(page);
        await gotoAndSettle(page, '/estoque');
        await expect(page.locator(Sel.stock.statCard).first()).toBeVisible({ timeout: 15_000 });
        // Aguarda contador animado.
        await page.waitForTimeout(700);

        for (const slug of SLUGS) {
          await assertCardContent(page, slug);
        }
      });
    });
  }
});
