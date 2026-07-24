/**
 * E2E: the catalog loads its data via direct PostgREST (`/rest/v1/...`) after the
 * invokeExternalDb → supabase.from() migration, and NOT via the external-db-bridge
 * edge function.
 */
import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";
import { expectVisibleByTestId } from "./helpers/waits";

test.describe("Catalog loads via PostgREST (no bridge)", () => {
  test("issues PostgREST reads and never calls external-db-bridge", async ({ page }) => {
    const restRequests: string[] = [];
    const bridgeRequests: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/rest/v1/")) restRequests.push(url);
      if (url.includes("/functions/v1/external-db-bridge")) bridgeRequests.push(url);
    });

    await gotoAndSettle(page, "/produtos");
    await expectVisibleByTestId(page, "product-grid");

    // Catalog data came through PostgREST …
    expect(restRequests.some((u) => /v_products_public|products/.test(u))).toBe(true);
    // … and the deprecated bridge was never invoked.
    expect(bridgeRequests).toHaveLength(0);
  });
});
