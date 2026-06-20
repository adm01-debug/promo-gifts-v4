/**
 * Fixture determinística para o cenário de cor esgotada (out-of-stock).
 *
 * installColorStockMock injeta uma variante "Preto Mock" com stock_quantity=0
 * via page.route, interceptando chamadas GET a product_variants.
 * O cenário valida que:
 *   - O swatch out-of-stock mantém dimensões > 0 (layout estável)
 *   - data-stock-state="out" é renderizado
 *   - O swatch permanece clicável e ganha aria-checked="true" ao ser clicado
 */
import type { Page, Route } from '@playwright/test';

export interface ColorStockMockOptions {
  productId: string;
  mockColorName?: string;
  mockStockQty?: number;
}

export async function installColorStockMock(
  page: Page,
  options: ColorStockMockOptions,
): Promise<void> {
  const { productId, mockColorName = 'Preto Mock', mockStockQty = 0 } = options;

  await page.route(/\/rest\/v1\/product_variants/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();

    // Fetch the real response first
    let response;
    try {
      response = await route.fetch();
    } catch {
      return route.fallback();
    }

    let rows: unknown[] = [];
    try {
      rows = await response.json();
    } catch {
      return route.fallback();
    }

    if (!Array.isArray(rows)) return route.fallback();

    // Only inject the mock variant if this response is for the target product
    const hasTargetProduct = rows.some(
      (r) => r && typeof r === 'object' && (r as Record<string, unknown>).product_id === productId,
    );
    // Also inject when the URL references the productId (batch queries via `in.(...)`)
    const urlHasProduct = route.request().url().includes(productId);

    if (!hasTargetProduct && !urlHasProduct) {
      return route.fulfill({
        status: response.status(),
        headers: Object.fromEntries(response.headers()),
        body: JSON.stringify(rows),
      });
    }

    const mockVariant = {
      id: `mock-preto-${productId}`,
      product_id: productId,
      sku: `MOCK-PRETO-${productId.slice(0, 8).toUpperCase()}`,
      name: mockColorName,
      color_id: null,
      color_name: mockColorName,
      color_hex: '#000000',
      color_code: null,
      stock_quantity: mockStockQty,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const enhanced = [...rows, mockVariant];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-${enhanced.length - 1}/${enhanced.length}`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(enhanced),
    });
  });
}
