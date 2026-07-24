import { test, expect } from '@playwright/test';

test.describe('Product Card Layout and Typography E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/produtos');
    await page.waitForSelector('[data-testid="product-card"]');
  });

  const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`SKU dentro da imagem (10.5px) e fornecedor abaixo — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const firstCard = page.locator('[data-testid="product-card"]').first();

      // SKU agora vive como badge sobreposto na imagem
      const sku = firstCard.locator('[data-testid="product-card-sku"]').first();
      await expect(sku).toBeVisible();
      await expect(sku).toHaveClass(/text-\[10\.5px\]/);

      // Fornecedor permanece no rodapé do card
      const supplier = firstCard.locator('span[title^="Fornecedor:"]').first();
      await expect(supplier).toBeVisible();

      // Garante que NÃO há SKU duplicado fora da imagem
      const skuBadges = await firstCard.locator('[data-testid="product-card-sku"]').count();
      expect(skuBadges).toBe(1);
    });
  }
});
