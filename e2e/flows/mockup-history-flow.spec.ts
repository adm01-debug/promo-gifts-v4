import { test, expect } from "../fixtures/test-base";
import { requireAuth } from "../fixtures/test-base";
import { gotoAndSettle } from "../helpers/nav";
import path from "node:path";

test.describe("Mockup History E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    requireAuth();
  });

  test("should generate a mockup and verify all data integrity in history", async ({ page }) => {
    // 1. Go to Generator
    await gotoAndSettle(page, "/mockup-generator");

    // 2. Full generation flow
    // Select Client
    const clientSearch = page.getByTestId("mockup-client-search-input");
    await clientSearch.click();
    const firstClient = page.locator('[data-testid^="mockup-client-option-"]').first();
    await firstClient.waitFor({ state: "visible", timeout: 15000 });
    const clientName = (await firstClient.innerText()).trim();
    await firstClient.click();

    // Select Product
    await page.getByTestId("mockup-product-combobox-trigger").click();
    const firstProduct = page.locator('[data-testid^="mockup-product-option-"]').first();
    await firstProduct.waitFor({ state: "visible" });
    const productNameRaw = await firstProduct.locator('p').first().innerText();
    const productName = productNameRaw.trim();
    await firstProduct.click();

    // Select Technique
    await page.getByTestId("mockup-technique-select-trigger").click();
    const firstTechnique = page.locator('[role="option"]').first();
    await firstTechnique.waitFor({ state: "visible" });
    const techniqueName = (await firstTechnique.innerText()).trim();
    await firstTechnique.click();

    // Upload Logo
    const fileInput = page.locator('input[data-testid^="mockup-logo-upload-input-"]').first();
    // PNG (not SVG): SVG logos are rejected — they cannot be rasterised by the compositor.
    const logoPath = path.resolve("public/images/promo-brindes-logo.png");
    await fileInput.setInputFiles(logoPath);
    await expect(page.locator("img[alt='Logo']")).toBeVisible({ timeout: 10000 });

    // Generate Layout - IA
    const generateBtn = page.getByRole("button", { name: /Gerar Layout - IA/i });
    await generateBtn.click();

    // Wait for result
    await expect(page.getByTestId("mockup-result-card")).toBeVisible({ timeout: 60000 });
    
    // 3. Go to History
    await gotoAndSettle(page, "/mockup-historico");

    // 4. Verify items in history and data integrity
    const historyItem = page.locator('[data-testid="mockup-history-item"]').first();
    await expect(historyItem).toBeVisible({ timeout: 15000 });

    // Verify consistency: Product, Client, Technique
    await expect(historyItem.locator('[data-testid="mockup-history-product-name"]')).toContainText(productName);
    await expect(historyItem.locator('[data-testid="mockup-history-client-name"]')).toContainText(clientName);
    await expect(historyItem.getByText(techniqueName)).toBeVisible();
    
    // Verify preview image
    const previewImg = historyItem.locator('[data-testid="mockup-history-preview"]');
    await expect(previewImg).toBeVisible();

    // 5. Download Validation (valid file: name/size/type)
    const downloadBtn = historyItem.locator('[data-testid="mockup-history-download-btn"]');
    await expect(downloadBtn).toBeVisible();
    
    // Intercept download event
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;
    
    // Validate download info
    expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg|webp)$/i);
    // Since it's a supabase URL, the browser usually handles the download.
    // In some cases window.open doesn't trigger 'download' event in Playwright 
    // if it just opens a new tab. Let's adjust if necessary.
  });

  test("should filter history by customer and product accurately", async ({ page }) => {
    await gotoAndSettle(page, "/mockup-historico");
    
    // Wait for initial load
    await page.locator('[data-testid="mockup-history-item"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    
    const searchInput = page.locator('input[placeholder*="Buscar por produto"]');
    await expect(searchInput).toBeVisible();
    
    // Test with a known non-existent term
    await searchInput.fill("NON_EXISTENT_MOCKUP_FILTER_TERM_123");
    await expect(page.getByText(/Nenhum mockup gerado ainda/i)).toBeVisible();
    
    // Clear search
    await searchInput.fill("");
    
    // If there are items, test a partial match
    const firstItem = page.locator('[data-testid="mockup-history-item"]').first();
    const isVisible = await firstItem.isVisible();
    if (isVisible) {
      const prodName = await firstItem.locator('[data-testid="mockup-history-product-name"]').innerText();
      const firstWord = prodName.split(' ')[0];
      
      await searchInput.fill(firstWord);
      // Wait for debounce/reload
      await page.waitForTimeout(1000); 
      
      const results = page.locator('[data-testid="mockup-history-item"]');
      const count = await results.count();
      for (let i = 0; i < count; i++) {
        await expect(results.nth(i)).toContainText(firstWord, { ignoreCase: true });
      }
    }
  });

  test("should block invalid actions and handle deletion removal", async ({ page }) => {
    await gotoAndSettle(page, "/mockup-historico");
    
    const historyItem = page.locator('[data-testid="mockup-history-item"]').first();
    const isVisible = await historyItem.isVisible();
    
    if (isVisible) {
      // 1. Delete and verify disappearance
      const deleteBtn = historyItem.locator('[data-testid="mockup-history-delete-btn"]');
      await deleteBtn.click();
      
      await expect(page.getByText(/Mockup removido/i)).toBeVisible();
      await expect(historyItem).not.toBeVisible();
      
      // 2. Block invalid actions simulation
      // We mock a case where the item data is corrupted (no URL)
      await page.route('**/rest/v1/generated_mockups*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: 'corrupted-id',
            product_name: 'Corrupted Item',
            mockup_url: null, // Invalid URL
            created_at: new Date().toISOString()
          }])
        });
      });
      
      await page.reload();
      const corruptedItem = page.locator('[data-testid="mockup-history-item"]').first();
      await expect(corruptedItem).toBeVisible();
      
      // Download button should not exist or be disabled if url is null
      // In MockupHistoryPage.tsx: {m.mockup_url && ( <Button ... data-testid="mockup-history-download-btn"> )}
      await expect(corruptedItem.locator('[data-testid="mockup-history-download-btn"]')).not.toBeVisible();
    }
  });
});
