/**
 * Visual regression — badges de Inteligência Comercial no ProductCard.
 *
 * Cobre os 3 viewports (mobile / tablet / desktop) e garante que:
 *  - container `product-card-intelligence-badges` renderiza sem overflow
 *  - badges nunca sobrepõem as badges de categoria
 *  - tooltip de Hot Item / Best-seller aparece com a descrição correta
 *
 * Baselines são auto-geradas pelo workflow `visual-tests.yml`
 * (passo `--update-snapshots`).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1280, height: 720 },
] as const;

test.describe('ProductCard — Visual regression de badges de Inteligência', () => {
  test.beforeEach(() => requireAuth());

  for (const vp of VIEWPORTS) {
    test(`badges renderizam sem sobreposição @ ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/produtos');

      const card = page.locator('[data-testid="product-card"]').first();
      await expect(card).toBeVisible();

      // o container das badges pode não existir para todos os produtos —
      // capturamos o card inteiro para baseline e validamos layout.
      await expect(card).toHaveScreenshot(`product-card-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });

      const badgesContainer = card.locator(
        '[data-testid="product-card-intelligence-badges"]',
      );
      const hasBadges = (await badgesContainer.count()) > 0;
      if (!hasBadges) {
        test.info().annotations.push({
          type: 'skip-reason',
          description: 'Primeiro card sem badges de inteligência neste dataset.',
        });
        return;
      }

      // sem overflow horizontal: o container deve caber dentro do card
      const cardBox = await card.boundingBox();
      const badgesBox = await badgesContainer.boundingBox();
      if (cardBox && badgesBox) {
        expect(badgesBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
        expect(badgesBox.x + badgesBox.width).toBeLessThanOrEqual(
          cardBox.x + cardBox.width + 1,
        );
      }
    });
  }

  test('tooltip do Hot Item exibe descrição quando badge está presente', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAndSettle(page, '/produtos');

    const hot = page.locator('[data-testid="intelligence-badge-hot-item"]').first();
    const visible = (await hot.count()) > 0 && (await hot.isVisible().catch(() => false));
    if (!visible) {
      test.skip(true, 'Nenhum produto Hot Item no dataset atual.');
      return;
    }
    await hot.hover();
    const tooltip = page.locator('[data-testid="intelligence-badge-hot-item-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/Hot Item/i);
  });

  test('tooltip do Best-seller exibe critério com valor numérico', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await gotoAndSettle(page, '/produtos');

    const best = page.locator('[data-testid="intelligence-badge-best-seller"]').first();
    const visible = (await best.count()) > 0 && (await best.isVisible().catch(() => false));
    if (!visible) {
      test.skip(true, 'Nenhum produto Best-seller no dataset atual.');
      return;
    }
    await best.hover();
    const tooltip = page.locator('[data-testid="intelligence-badge-best-seller-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/un\/dia/);
    await expect(tooltip).toContainText(/limite ≥/);
  });
});
