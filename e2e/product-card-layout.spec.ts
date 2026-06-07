import { test, expect } from '@playwright/test';

test.describe('Product Card Layout and Typography E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Acessa o catálogo
    await page.goto('/produtos');
    // Espera os produtos carregarem
    await page.waitForSelector('[data-testid="product-card"]');
  });

  const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`deve garantir fornecedor à esquerda e SKU à direita no ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      
      const firstCard = page.locator('[data-testid="product-card"]').first();
      const infoContainer = firstCard.locator('.flex.min-w-0.items-center.justify-between');
      
      // Verifica se o container tem a classe de distribuição correta
      await expect(infoContainer).toHaveClass(/justify-between/);

      const supplier = infoContainer.locator('span[title^="Fornecedor:"]');
      const sku = infoContainer.locator('span[aria-label^="Código do produto:"]');

      // Verifica visibilidade
      await expect(supplier).toBeVisible();
      await expect(sku).toBeVisible();

      // Verifica ordem visual usando box-model (bounding box)
      const supplierBox = await supplier.boundingBox();
      const skuBox = await sku.boundingBox();

      if (supplierBox && skuBox) {
        // O X do fornecedor deve ser menor que o X do SKU (esquerda -> direita)
        expect(supplierBox.x).toBeLessThan(skuBox.x);
      }

      // Validação de tipografia do SKU (deve ter as classes de 11.5px/13.8px)
      if (vp.name === 'Mobile') {
        await expect(sku).toHaveClass(/text-\[11.5px\]/);
      } else {
        await expect(sku).toHaveClass(/sm:text-\[13.8px\]/);
      }
    });
  }
});
