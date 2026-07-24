/**
 * E2E: when a deprecated PostgREST relation answers `410 Gone`, the direct-PostgREST
 * read path degrades to an empty result and the UI shows a friendly empty state
 * instead of crashing (white screen / uncaught error).
 */
import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("PostgREST 410 resilience", () => {
  test("catalog shows a friendly empty state when the products read is 410 Gone", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Force the products read to 410 Gone.
    await page.route("**/rest/v1/v_products_public**", async (route) => {
      await route.fulfill({
        status: 410,
        contentType: "application/json",
        body: JSON.stringify({ message: "Gone", code: "410" }),
      });
    });

    await gotoAndSettle(page, "/produtos");

    // Friendly empty state, not a crash.
    const emptyState = page.locator('[data-testid="empty-catalog-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("Nenhum produto encontrado");

    // No uncaught runtime errors leaked to the page.
    expect(pageErrors).toHaveLength(0);
  });
});
