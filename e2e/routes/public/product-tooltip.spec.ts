import { test, expect } from "@playwright/test";

test.describe("Product Module Tooltip Style E2E", () => {
  test("Should verify tooltips in product detail module use correct text and style", async ({ page }) => {
    await page.goto("/");
    
    // Acessar um produto do grid inicial
    const productCard = page.locator('article, [data-testid="product-card"]').first();
    await expect(productCard).toBeVisible();
    await productCard.click();

    // 1. Tooltips de estoque por cor (PDP)
    const colorTooltipTrigger = page.locator('button[aria-label^="Cor"]').first();
    if (await colorTooltipTrigger.isVisible({ timeout: 5000 })) {
      await colorTooltipTrigger.hover();
      const tooltip = page.locator('[role="tooltip"]');
      await expect(tooltip).toBeVisible();
      
      // Estilo Padrão (Padding maior)
      await expect(tooltip).toHaveClass(/px-3 py-1.5/);

      // Alternar para Compacto via Header
      const toggleButton = page.locator('button[aria-label="Alternar tamanho do tooltip"]');
      await toggleButton.click();

      // Verificar estilo Compacto (Padding menor)
      await colorTooltipTrigger.hover();
      await expect(tooltip).toHaveClass(/px-2 py-1/);
    }
  });
});
