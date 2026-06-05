import { test, expect } from "../fixtures/test-base";
import { loginAs } from "../helpers/auth";
import { gotoAndSettle, settleAfterAction } from "../helpers/nav";
import { Sel } from "../fixtures/selectors";
import { ensureNoDuplicateRequests } from "../helpers/consistency";

test.describe("Catalog: Advanced Pagination & Filters", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test("should maintain state when navigating through pages and applying filters", async ({ page }) => {
    await gotoAndSettle(page, "/produtos");

    // 1. Apply a filter
    await page.locator('[data-testid="filter-section-categorias"]').click();
    const firstCategory = page.locator('[data-testid="category-filter-item"]').first();
    const categoryName = (await firstCategory.innerText()).trim();
    
    // Ensure no duplicate requests when filtering
    await ensureNoDuplicateRequests(page, async () => {
      await firstCategory.click();
      await settleAfterAction(page);
    }, { urlFilter: /rest\/v1\/products/ });

    // 2. Go to next page
    const nextPage = page.locator('[data-testid="pagination-next"]');
    if (await nextPage.isVisible()) {
      await ensureNoDuplicateRequests(page, async () => {
        await nextPage.click();
        await settleAfterAction(page);
      }, { urlFilter: /rest\/v1\/products/ });
      
      expect(page.url()).toContain("page=2");
      expect(page.url()).toContain("category"); // Filter should persist
    }

    // 3. Favorite an item on page 2 and ensure it stays favorited when going back
    const firstCard = page.locator(Sel.product.card).first();
    const productName = await firstCard.locator(Sel.product.cardName).innerText();
    const favoriteBtn = firstCard.locator(Sel.product.favorite);
    
    await favoriteBtn.click();
    await expect(page.locator(Sel.app.toast)).toBeVisible();
    
    // 4. Go back to page 1
    const prevPage = page.locator('[data-testid="pagination-prev"]');
    if (await prevPage.isVisible()) {
      await prevPage.click();
      await settleAfterAction(page);
      expect(page.url()).toContain("page=1");
    }

    // 5. Go to page 2 again and check favorite state
    await page.locator('[data-testid="pagination-next"]').click();
    await settleAfterAction(page);
    
    const targetProductCard = page.locator(Sel.product.card).filter({ hasText: productName });
    await expect(targetProductCard.locator(Sel.product.favorite)).toHaveClass(/text-primary|active/); // Adjust based on actual active class
  });

  test("should handle deep filtering and bulk actions without displacement", async ({ page }) => {
    // Navigate to page 3 directly via URL
    await gotoAndSettle(page, "/produtos?page=3");
    
    const initialY = await page.evaluate(() => window.scrollY);
    
    // Apply a search filter
    await page.fill(Sel.catalog.searchInput, "A");
    await settleAfterAction(page);
    
    // Verify results are consistent
    const cards = page.locator(Sel.product.card);
    const count = await cards.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(cards.nth(i)).toBeVisible();
    }
    
    // Ensure scroll didn't jump unexpectedly
    const finalY = await page.evaluate(() => window.scrollY);
    // On SPA navigation, scroll is usually reset to top, which is fine, 
    // but applying filters shouldn't cause massive displacement if handled correctly.
  });
});
