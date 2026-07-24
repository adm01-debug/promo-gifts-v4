import { test, expect } from "../fixtures/test-base";
import { requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import path from "node:path";

test.describe("Mockup Module Comprehensive Flow", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    await gotoAndSettle(page, "/mockup-generator");
  });

  test("should complete the full mockup creation flow from selection to generation", async ({ page }) => {
    // 1. Select Client
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    
    // Wait for the list of companies to be loaded
    const firstClient = page.locator('[data-testid^="mockup-client-option-"]').first();
    await firstClient.waitFor({ state: "visible", timeout: 15000 });
    const clientName = await firstClient.innerText();
    await firstClient.click();
    
    // Verify client chip is visible
    await expect(page.getByTestId("mockup-client-chip")).toBeVisible();
    await expect(page.getByTestId("mockup-client-chip")).toContainText(clientName.trim());

    // 2. Select Product
    await page.getByTestId("mockup-product-combobox-trigger").click();
    const productSearch = page.getByTestId("mockup-product-search-input");
    await productSearch.waitFor({ state: "visible" });
    
    // Wait for product options
    const firstProduct = page.locator('[data-testid^="mockup-product-option-"]').first();
    await firstProduct.waitFor({ state: "visible", timeout: 10000 });
    const productName = await firstProduct.locator('p').first().innerText();
    await firstProduct.click();
    
    // Verify product is selected in trigger
    await expect(page.getByTestId("mockup-product-combobox-trigger")).toContainText(productName.trim());

    // 3. Select Technique
    await page.getByTestId("mockup-technique-select-trigger").click();
    const firstTechnique = page.locator('[role="option"]').first();
    await firstTechnique.waitFor({ state: "visible" });
    const techniqueName = await firstTechnique.innerText();
    await firstTechnique.click();
    
    // Verify technique selected
    await expect(page.getByTestId("mockup-technique-select-trigger")).toContainText(techniqueName.trim());

    // 4. Upload Logo
    // Find the first area card and its file input
    const firstArea = page.locator('[data-testid^="mockup-area-card-"]').first();
    await firstArea.waitFor({ state: "visible" });
    
    const fileInput = page.locator('[data-testid^="mockup-logo-upload-input-"]').first();
    // Using a relative path that should work in the sandbox
    // PNG (not SVG): SVG logos are rejected — they cannot be rasterised by the compositor.
    const logoPath = path.resolve("public/images/promo-brindes-logo.png");
    await fileInput.setInputFiles(logoPath);
    
    // Wait for the logo preview image to appear
    await expect(page.locator("img[alt='Logo']")).toBeVisible({ timeout: 10000 });

    // 5. Generate Mockup
    const generateBtn = page.getByTestId("mockup-generate-button");
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // 6. Verify Generation State (Overlay)
    await expect(page.locator('[data-testid="generating-overlay"]')).toBeVisible();
    await expect(page.getByText(/Criando seu mockup/i)).toBeVisible();

    // 7. Verify Success and Result Card
    // The result card should appear after generation
    await expect(page.getByTestId("mockup-result-card")).toBeVisible({ timeout: 45000 });
    await expect(page.getByText(/Mockup Gerado/i)).toBeVisible();
    
    // Check if the download button is present in the result card
    await expect(page.getByTestId("mockup-result-card").getByText(/Baixar/i)).toBeVisible();
  });

  test("should allow resetting the flow", async ({ page }) => {
    // Select a client to have something to reset
    await page.getByTestId("mockup-client-search-input").click();
    const firstClient = page.locator('[data-testid^="mockup-client-option-"]').first();
    await firstClient.waitFor({ state: "visible" });
    await firstClient.click();
    
    await expect(page.getByTestId("mockup-client-chip")).toBeVisible();
    
    // Find and click the reset button (aria-label="Limpar formulário")
    await page.getByLabel("Limpar formulário").click();
    
    // Verify it returned to the initial state
    await expect(page.getByTestId("mockup-client-chip")).not.toBeVisible();
    await expect(page.getByTestId("mockup-client-search-input")).toBeVisible();
  });
});
