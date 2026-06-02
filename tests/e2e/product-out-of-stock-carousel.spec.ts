import { test, expect } from '@playwright/test';

/**
 * E2E test: navigate carousel states (scroll/next/prev) and verify that 
 * the "Fora de estoque" badge stays anchored in the top-left of each card,
 * never drifting or overlapping other elements as the carousel moves.
 */
test.describe('Out of Stock Badge — Carousel positioning', () => {
  test('Badge stays in top-left while scrolling carousel', async ({ page }) => {
    // The SmartRecommendations/related-products carousel typically appears on PDP
    // Use the catalog or home page that contains a horizontal product carousel
    await page.goto('/produtos');
    await page.waitForLoadState('domcontentloaded');

    // Find any horizontal scroller that contains a "Fora de estoque" badge
    const badgeLocator = page.locator(':text-matches("Fora de estoque", "i")').first();

    if (!(await badgeLocator.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No out-of-stock product available in this environment');
      return;
    }

    // Resolve carousel container (closest scrollable ancestor)
    const cardWithBadge = badgeLocator.locator('xpath=ancestor::article[1]');
    await expect(cardWithBadge).toBeVisible();

    const initialBadgeBox = await badgeLocator.boundingBox();
    const initialCardBox = await cardWithBadge.boundingBox();
    expect(initialBadgeBox).not.toBeNull();
    expect(initialCardBox).not.toBeNull();

    if (initialBadgeBox && initialCardBox) {
      // Relative position from card top-left should be within top-left quadrant
      const relX = initialBadgeBox.x - initialCardBox.x;
      const relY = initialBadgeBox.y - initialCardBox.y;
      expect(relX).toBeLessThan(initialCardBox.width * 0.35);
      expect(relY).toBeLessThan(initialCardBox.height * 0.3);
    }

    // Try carousel "next" button — typically labeled in PT-BR
    const nextBtn = page.getByRole('button', { name: /Rolar para a direita|Próxima|Next/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(400);

      // Badge should still be in top-left relative to its (now possibly different) card
      const visibleBadge = page.locator(':text-matches("Fora de estoque", "i")').first();
      if (await visibleBadge.isVisible().catch(() => false)) {
        const newCard = visibleBadge.locator('xpath=ancestor::article[1]');
        const badgeBox = await visibleBadge.boundingBox();
        const cardBox = await newCard.boundingBox();
        if (badgeBox && cardBox) {
          expect(badgeBox.x - cardBox.x).toBeLessThan(cardBox.width * 0.35);
          expect(badgeBox.y - cardBox.y).toBeLessThan(cardBox.height * 0.3);
        }
      }
    }

    // Try carousel "prev" button
    const prevBtn = page.getByRole('button', { name: /Rolar para a esquerda|Anterior|Previous/i }).first();
    if (await prevBtn.isVisible().catch(() => false)) {
      await prevBtn.click();
      await page.waitForTimeout(400);

      const visibleBadge = page.locator(':text-matches("Fora de estoque", "i")').first();
      if (await visibleBadge.isVisible().catch(() => false)) {
        const newCard = visibleBadge.locator('xpath=ancestor::article[1]');
        const badgeBox = await visibleBadge.boundingBox();
        const cardBox = await newCard.boundingBox();
        if (badgeBox && cardBox) {
          expect(badgeBox.x - cardBox.x).toBeLessThan(cardBox.width * 0.35);
          expect(badgeBox.y - cardBox.y).toBeLessThan(cardBox.height * 0.3);
        }
      }
    }

    // Programmatic scroll on horizontal scrollers as a fallback
    const scrollers = page.locator('[role="list"].overflow-x-auto, .snap-x.overflow-x-auto');
    const count = await scrollers.count();
    for (let i = 0; i < count; i++) {
      const s = scrollers.nth(i);
      await s.evaluate((el) => el.scrollBy({ left: 400, behavior: 'instant' as ScrollBehavior }));
    }
    await page.waitForTimeout(200);

    const finalBadge = page.locator(':text-matches("Fora de estoque", "i")').first();
    if (await finalBadge.isVisible().catch(() => false)) {
      const card = finalBadge.locator('xpath=ancestor::article[1]');
      const badgeBox = await finalBadge.boundingBox();
      const cardBox = await card.boundingBox();
      if (badgeBox && cardBox) {
        expect(badgeBox.x - cardBox.x).toBeLessThan(cardBox.width * 0.35);
        expect(badgeBox.y - cardBox.y).toBeLessThan(cardBox.height * 0.3);
      }
    }
  });
});
