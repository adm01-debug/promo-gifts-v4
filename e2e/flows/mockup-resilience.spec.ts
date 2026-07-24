import { test, expect } from "../fixtures/test-base";
import { requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import path from "node:path";

test.describe("Mockup Resilience and Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    await gotoAndSettle(page, "/mockup-generator");
  });

  test("should handle generation timeout and recover correctly", async ({ page }) => {
    // 1. Fill minimal data
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    await page.locator('[data-testid^="mockup-client-option-"]').first().click();

    await page.getByTestId("mockup-product-combobox-trigger").click();
    await page.locator('[data-testid^="mockup-product-option-"]').first().click();

    await page.getByTestId("mockup-technique-select-trigger").click();
    await page.locator('[role="option"]').first().click();

    const fileInput = page.locator('input[data-testid^="mockup-logo-upload-input-"]').first();
    const logoPath = path.resolve("public/images/promo-brindes-logo.png");
    await fileInput.setInputFiles(logoPath);
    await expect(page.locator("img[alt='Logo']")).toBeVisible();

    // 2. Mock a timeout for the generation API
    // We delay the response significantly to simulate a slow network/IA
    await page.route("**/functions/v1/generate-mockup", async (route) => {
      // Delay for 3 seconds then return error
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ error: "IA service timeout" })
      });
    });

    const generateBtn = page.getByRole("button", { name: /Gerar Layout - IA/i });
    await generateBtn.click();

    // 3. Verify loading state (Skeleton/Overlay)
    // The overlay should be visible while "waiting" for the delayed response
    await expect(page.locator('[data-testid="generating-overlay"]')).toBeVisible();

    // 4. Wait for error message
    await expect(page.getByText(/IA service timeout/i)).toBeVisible({ timeout: 10000 });
    
    // 5. Verify "Generate" button is re-enabled
    await expect(generateBtn).toBeEnabled();
  });

  test("should persist configuration and position after page reload", async ({ page }) => {
    // 1. Fill data and adjust position
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    const clientOption = page.locator('[data-testid^="mockup-client-option-"]').first();
    const clientName = (await clientOption.innerText()).trim();
    await clientOption.click();

    await page.getByTestId("mockup-product-combobox-trigger").click();
    const productOption = page.locator('[data-testid^="mockup-product-option-"]').first();
    const productName = (await productOption.innerText()).trim();
    await productOption.click();

    const fileInput = page.locator('input[data-testid^="mockup-logo-upload-input-"]').first();
    await fileInput.setInputFiles(path.resolve("public/images/promo-brindes-logo.png"));

    // Move logo to center
    const centerBtn = page.getByRole("button", { name: /^Centro$/i });
    await centerBtn.click();
    await expect(page.getByText(/Pos: 50% × 50%/i)).toBeVisible();

    // Rotate +15
    await page.getByRole("button", { name: "+15°" }).click();
    await expect(page.getByText(/Rot: 15°/i)).toBeVisible();

    // 2. Wait for auto-save (debounce is 2000ms)
    await page.waitForTimeout(3000);

    // 3. Reload
    await page.reload();
    await expect(page.getByText(/Rascunho restaurado/i)).toBeVisible();

    // 4. Verify everything is back
    await expect(page.getByTestId("mockup-client-chip")).toContainText(clientName);
    // Combobox trigger might show product name
    await expect(page.getByTestId("mockup-product-combobox-trigger")).toContainText(productName);
    await expect(page.locator("img[alt='Logo']")).toBeVisible();
    await expect(page.getByText(/Pos: 50% × 50%/i)).toBeVisible();
    await expect(page.getByText(/Rot: 15°/i)).toBeVisible();
  });

  test("should allow retry after failure without losing selections", async ({ page }) => {
    // 1. Setup
    await page.getByTestId("mockup-client-search-input").click();
    await page.locator('[data-testid^="mockup-client-option-"]').first().click();
    await page.getByTestId("mockup-product-combobox-trigger").click();
    await page.locator('[data-testid^="mockup-product-option-"]').first().click();
    await page.getByTestId("mockup-technique-select-trigger").click();
    await page.locator('[role="option"]').first().click();
    await page.locator('input[data-testid^="mockup-logo-upload-input-"]').first().setInputFiles(path.resolve("public/images/promo-brindes-logo.png"));

    // 2. Mock 1st fail, 2nd success
    let callCount = 0;
    await page.route("**/functions/v1/generate-mockup", async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: "Temporary IA failure" })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          // Real edge returns both camelCase (read by the frontend) and snake_case.
          body: JSON.stringify({
            ok: true,
            mockupUrl: "https://example.com/mockup.png",
            mockup_url: "https://example.com/mockup.png",
          })
        });
      }
    });

    const generateBtn = page.getByRole("button", { name: /Gerar Layout - IA/i });
    
    // First attempt
    await generateBtn.click();
    await expect(page.getByText(/Temporary IA failure/i)).toBeVisible();
    
    // Check filters are still there
    await expect(page.getByTestId("mockup-client-chip")).toBeVisible();
    
    // Second attempt
    await generateBtn.click();
    await expect(page.getByTestId("mockup-result-card")).toBeVisible({ timeout: 15000 });
    await expect(page.locator('img[src="https://example.com/mockup.png"]')).toBeVisible();
  });

  test("should show skeletons during data loading deterministically", async ({ page }) => {
    // 1. Mock slow tech data fetch
    await page.route("**/rest/v1/tabela_preco_gravacao_oficial*", async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.continue();
    });

    // 2. Trigger reload to see loading states
    await page.reload();
    
    // 3. Check for skeletons
    // In MockupConfigPanel.tsx, there's a loader or skeleton when isLoadingData is true
    // From MockupGenerator.tsx: fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
    // And in MockupConfigPanel it might have its own skeleton
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // After loading finishes
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("mockup-client-search-input")).toBeVisible();
  });
});
