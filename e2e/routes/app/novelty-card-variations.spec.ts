import { test, expect } from '@playwright/test';

test.describe('Novelty Card Variations @mobile', () => {
  test.beforeEach(async ({ context }) => {
    // Regressão visual autenticada: requer login real (E2E_USER_*) e baselines
    // commitados. Sem credenciais (full-ci / visual-tests sem secrets) pula
    // limpo em vez de falhar — espelha requireAuth() do test-base.
    test.skip(
      !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
      'E2E_USER_EMAIL/PASSWORD não configurados — baseline visual autenticada indisponível',
    );
    await context.route('**/functions/v1/novelties**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            novelty_id: 'var-1',
            product_id: 'p-1',
            product_name: 'Produto com título extremamente longo que deve ocupar pelo menos três ou quatro linhas no grid para testar o alinhamento e o truncamento de texto',
            product_sku: 'SKU-LONG-TITLE',
            product_image: 'https://placehold.co/400x400?text=Normal',
            base_price: 150.50,
            stock_quantity: 100,
            stock_status: 'in-stock',
            detected_at: new Date().toISOString(),
            days_remaining: 30,
            supplier_name: 'Fornecedor A',
            category_name: 'Categoria Alpha'
          },
          {
            novelty_id: 'var-2',
            product_id: 'p-2',
            product_name: 'Preço sob consulta',
            product_sku: 'SKU-QUERY-PRICE',
            product_image: 'https://placehold.co/400x400?text=Price+Query',
            base_price: 0,
            stock_quantity: 50,
            stock_status: 'low-stock',
            detected_at: new Date().toISOString(),
            days_remaining: 15,
            supplier_name: 'Fornecedor B',
            category_name: 'Categoria Beta'
          },
          {
            novelty_id: 'var-3',
            product_id: 'p-3',
            product_name: 'Imagem Ausente',
            product_sku: 'SKU-NO-IMAGE',
            product_image: null,
            base_price: 89.90,
            stock_quantity: 0,
            stock_status: 'out-of-stock',
            detected_at: new Date().toISOString(),
            days_remaining: 5,
            supplier_name: 'Fornecedor C',
            category_name: 'Categoria Gamma'
          }
        ])
      });
    });
  });

  test('Card Edge Cases - Visual Consistency', async ({ page }) => {
    await page.goto('/novidades');
    const grid = page.locator('div[role="list"]');
    await grid.waitFor({ state: 'visible' });

    await expect(grid).toHaveScreenshot('novelty-card-variations.png', {
      maxDiffPixelRatio: 0.05
    });

    const cards = page.locator('div[role="listitem"]');
    const count = await cards.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const h3 = card.locator('h3');
      const priceContainer = card.locator('.min-h-\\[3\\.25rem\\]');

      const h3Box = await h3.boundingBox();
      const priceBox = await priceContainer.boundingBox();

      if (h3Box) {
        expect(h3Box.height).toBeGreaterThanOrEqual(40);
      }
      if (priceBox) {
        expect(priceBox.height).toBeGreaterThanOrEqual(52);
      }
    }
  });
});
