import { test, expect } from '@playwright/test';

/**
 * E2E test to verify that "Out of Stock" (Fora de estoque) products 
 * are displayed correctly in different layouts (Grid, List, Carousel).
 */
test.describe('Product Out of Stock Visuals', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that contains products, usually the catalog
    await page.goto('/produtos');
  });

  test('Out of stock products should show only the badge in top-left without grayscale', async ({ page }) => {
    // 1. Find a product that is out of stock in the grid view
    // We search for the "Fora de estoque" badge which we just implemented
    const outOfStockBadge = page.locator('span:has-text("Fora de estoque")').first();
    
    // If no out-of-stock product is found on the first page, try to find one by searching or filtering
    if (!(await outOfStockBadge.isVisible())) {
      // Try to filter for out-of-stock products if there's a filter
      const filterButton = page.getByRole('button', { name: /Filtros/i }).first();
      if (await filterButton.isVisible()) {
        await filterButton.click();
        const outOfStockFilter = page.getByLabel(/Fora de estoque/i).or(page.locator('text=Sem estoque'));
        if (await outOfStockFilter.isVisible()) {
          await outOfStockFilter.click();
        }
      }
    }

    // Ensure we have at least one out-of-stock product visible
    await expect(page.locator('span:has-text("Fora de estoque")').first()).toBeVisible({ timeout: 10000 });

    const badge = page.locator('span:has-text("Fora de estoque")').first();
    const productCard = badge.locator('xpath=ancestor::article').first();
    const productImage = productCard.locator('img').first();

    // 2. Check position: should be in the top-left corner area
    // Top-left area check (bounding box)
    const badgeBox = await badge.boundingBox();
    const cardBox = await productCard.boundingBox();

    if (badgeBox && cardBox) {
      // Badge should be within the top 20% of the card and left 30%
      expect(badgeBox.x).toBeLessThan(cardBox.x + cardBox.width * 0.3);
      expect(badgeBox.y).toBeLessThan(cardBox.y + cardBox.height * 0.2);
    }

    // 3. Check for NO grayscale/opacity-blur overlay
    // The previous implementation had 'absolute inset-0' with background blur
    const overlay = productCard.locator('.absolute.inset-0.bg-background\\/60.backdrop-blur');
    await expect(overlay).not.toBeVisible();

    // Check if the image itself is not grayscaled via CSS
    const grayscaleValue = await productImage.evaluate(el => window.getComputedStyle(el).filter);
    expect(grayscaleValue).not.toContain('grayscale');
    
    const opacityValue = await productImage.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacityValue)).toBeGreaterThan(0.8);

    // 4. Test in List View
    const listViewButton = page.getByRole('button', { name: /Lista/i }).or(page.locator('button[aria-label="Ver em lista"]'));
    if (await listViewButton.isVisible()) {
      await listViewButton.click();
      
      const listBadge = page.locator('span:has-text("Fora de estoque")').first();
      await expect(listBadge).toBeVisible();
      
      const listBadgeBox = await listBadge.boundingBox();
      const listThumb = page.locator('.h-14.w-14, .h-\\[72px\\].w-\\[72px\\]').first(); // Thumbnail container
      const thumbBox = await listThumb.boundingBox();
      
      if (listBadgeBox && thumbBox) {
        // In list view, it should be anchored to the thumbnail
        expect(listBadgeBox.x).toBeGreaterThanOrEqual(thumbBox.x);
        expect(listBadgeBox.y).toBeGreaterThanOrEqual(thumbBox.y);
      }
    }

    // 5. Visual Regression / Snapshot (if enabled in environment)
    // await expect(productCard).toHaveScreenshot('out-of-stock-card.png');
  });

  test('Out of stock badge style should be consistent with other badges', async ({ page }) => {
    // Compare style with another badge (like "Novo")
    const outOfStockBadge = page.locator('span:has-text("Fora de estoque")').first();
    const noveltyBadge = page.locator('span:has-text("Novo")').first();

    if (await outOfStockBadge.isVisible() && await noveltyBadge.isVisible()) {
      const oosStyles = await outOfStockBadge.evaluate(el => {
        const style = window.getComputedStyle(el);
        return { fontSize: style.fontSize, padding: style.padding, fontWeight: style.fontWeight };
      });
      
      const noveltyStyles = await noveltyBadge.evaluate(el => {
        const style = window.getComputedStyle(el);
        return { fontSize: style.fontSize, padding: style.padding, fontWeight: style.fontWeight };
      });

      expect(oosStyles.fontSize).toBe(noveltyStyles.fontSize);
      expect(oosStyles.fontWeight).toBe(noveltyStyles.fontWeight);
    }
  });
});
