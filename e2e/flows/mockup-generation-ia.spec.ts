import { test, expect } from "../fixtures/test-base";
import { requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import path from "node:path";

test.describe("Mockup Generation IA Flow", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
    await gotoAndSettle(page, "/mockup-generator");
  });

  test("should complete the full flow including position adjustment and IA generation", async ({ page }) => {
    // 1. Select Client
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    
    const firstClient = page.locator('[data-testid^="mockup-client-option-"]').first();
    await firstClient.waitFor({ state: "visible", timeout: 15000 });
    const clientName = await firstClient.innerText();
    await firstClient.click();
    
    await expect(page.getByTestId("mockup-client-chip")).toBeVisible();
    await expect(page.getByTestId("mockup-client-chip")).toContainText(clientName.trim());

    // 2. Select Product
    await page.getByTestId("mockup-product-combobox-trigger").click();
    const firstProduct = page.locator('[data-testid^="mockup-product-option-"]').first();
    await firstProduct.waitFor({ state: "visible", timeout: 10000 });
    const productName = await firstProduct.locator('p').first().innerText();
    await firstProduct.click();
    
    await expect(page.getByTestId("mockup-product-combobox-trigger")).toContainText(productName.trim());

    // 3. Select Technique
    await page.getByTestId("mockup-technique-select-trigger").click();
    const firstTechnique = page.locator('[role="option"]').first();
    await firstTechnique.waitFor({ state: "visible" });
    const techniqueName = await firstTechnique.innerText();
    await firstTechnique.click();
    
    await expect(page.getByTestId("mockup-technique-select-trigger")).toContainText(techniqueName.trim());

    // 4. Upload Logo
    // Find the file input for the first area
    const fileInput = page.locator('input[data-testid^="mockup-logo-upload-input-"]').first();
    // PNG (not SVG): SVG logos are rejected — they cannot be rasterised by the compositor.
    const logoPath = path.resolve("public/images/promo-brindes-logo.png");
    await fileInput.setInputFiles(logoPath);
    
    // Wait for the logo preview image to appear in the editor
    await expect(page.locator("img[alt='Logo']")).toBeVisible({ timeout: 10000 });

    // 5. Adjust Position
    // Centering the logo
    const centerBtn = page.getByRole("button", { name: /^Centro$/i });
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();
    
    // Verify coordinates in status (LogoSizeControls shows this)
    await expect(page.getByText(/Pos: 50% × 50%/i)).toBeVisible();

    // Rotate +15°
    const rotateBtn = page.getByRole("button", { name: "+15°" });
    await rotateBtn.click();
    await expect(page.getByText(/Rot: 15°/i)).toBeVisible();

    // 6. Generate Mockup with IA
    // We use the "Gerar Layout - IA" button from MockupLayoutButtons
    const generateLayoutAiBtn = page.getByRole("button", { name: /Gerar Layout - IA/i });
    await expect(generateLayoutAiBtn).toBeVisible();
    await expect(generateLayoutAiBtn).toBeEnabled();
    await generateLayoutAiBtn.click();

    // 7. Verify Generation State (Overlay)
    // The overlay appears while the IA is working
    await expect(page.locator('[data-testid="generating-overlay"]')).toBeVisible();
    await expect(page.getByText(/Criando seu mockup/i)).toBeVisible();

    // 8. Verify Success and Result Card
    // The result card should appear after generation (increased timeout for IA)
    await expect(page.getByTestId("mockup-result-card")).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Mockup Gerado/i)).toBeVisible();
    
    // 9. Confirm that the final image is displayed
    const resultImage = page.getByTestId("mockup-result-card").locator("img").first();
    await expect(resultImage).toBeVisible();
    
    // Check if the download button is present in the result card
    await expect(page.getByTestId("mockup-result-card").getByText(/Baixar/i)).toBeVisible();
  });
});

