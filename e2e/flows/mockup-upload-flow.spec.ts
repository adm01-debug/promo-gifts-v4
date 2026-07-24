import { test, expect } from "../fixtures/test-base";
import { requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import path from "node:path";

test.describe("Mockup Module Upload Flow and Validations", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    await gotoAndSettle(page, "/mockup-generator");
  });

  test("should block generation until logo is uploaded and allow after", async ({ page }) => {
    // 1. Select Client
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    const firstClient = page.locator('[data-testid^="mockup-client-option-"]').first();
    await firstClient.waitFor({ state: "visible", timeout: 15000 });
    await firstClient.click();
    
    // 2. Select Product
    await page.getByTestId("mockup-product-combobox-trigger").click();
    const firstProduct = page.locator('[data-testid^="mockup-product-option-"]').first();
    await firstProduct.waitFor({ state: "visible" });
    await firstProduct.click();

    // 3. Select Technique
    await page.getByTestId("mockup-technique-select-trigger").click();
    const firstTechnique = page.locator('[role="option"]').first();
    await firstTechnique.waitFor({ state: "visible" });
    await firstTechnique.click();

    // 4. Verify "Gerar Layout" buttons are visible but DISABLED
    // Note: They are inside the LogoPositionEditor which appears after product selection
    const generateLayoutBtn = page.getByRole("button", { name: /^Gerar Layout$/i });
    const generateLayoutAiBtn = page.getByRole("button", { name: /Gerar Layout - IA/i });
    
    await expect(generateLayoutBtn).toBeVisible();
    await expect(generateLayoutAiBtn).toBeVisible();
    
    await expect(generateLayoutBtn).toBeDisabled();
    await expect(generateLayoutAiBtn).toBeDisabled();

    // 5. Upload Logo
    const fileInput = page.locator('input[data-testid^="mockup-logo-upload-input-"]').first();
    // PNG (not SVG): SVG logos are rejected — they cannot be rasterised by the compositor.
    const logoPath = path.resolve("public/images/promo-brindes-logo.png");
    await fileInput.setInputFiles(logoPath);

    // 6. Verify buttons are now ENABLED
    await expect(generateLayoutBtn).toBeEnabled();
    await expect(generateLayoutAiBtn).toBeEnabled();

    // 7. Test Art File Upload (Optional but good for completeness)
    const artDropzone = page.getByTestId("mockup-art-file-dropzone");
    await expect(artDropzone).toBeVisible();
    
    // Find the hidden input inside the dropzone
    const artInput = artDropzone.locator('input[type="file"]');
    await artInput.setInputFiles(logoPath); // Reusing the same file for testing

    // Verify art file is listed
    await expect(page.getByText("promo-brindes-logo.png")).toBeVisible();

    // 8. Generate and verify success
    await generateLayoutAiBtn.click();
    await expect(page.locator('[data-testid="generating-overlay"]')).toBeVisible();
    
    // Wait for result card
    await expect(page.getByTestId("mockup-result-card")).toBeVisible({ timeout: 60000 });
  });
});
