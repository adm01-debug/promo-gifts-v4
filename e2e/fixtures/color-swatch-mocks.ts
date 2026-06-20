/**
 * Fixture determinística para specs de swatches de cor out-of-stock.
 *
 * installColorStockMock — Intercepta chamadas REST de variantes para um
 * produto específico e injeta uma variante "Preto Mock" com stock_quantity=0.
 *
 * Intercepta APENAS requests com `product_id=eq.{productId}` (single-product)
 * deixando requests em lote `product_id=in.(...)` passarem normalmente.
 * Isso garante que os swatches do catálogo (useProductsColorsBatch)
 * mostrem dados reais, enquanto hooks de detalhe (useExternalVariantStock)
 * recebem o cenário determinístico.
 *
 * Uso:
 *   await installColorStockMock(page, { productId });
 *   await page.reload();
 *   // swatch "Preto Mock" aparece apenas em contextos de detalhe (quickview etc.)
 */
import type { Page, Route } from '@playwright/test';

interface ColorStockMockOptions {
  /** Product ID real cuja variante será substituída pela "Preto Mock" esgotada. */
  productId: string;
}

const NOW = new Date().toISOString();

export async function installColorStockMock(
  page: Page,
  { productId }: ColorStockMockOptions,
): Promise<void> {
  const MOCK_ROW = {
    id: 'mock-preto-variant-001',
    product_id: productId,
    sku: 'MOCK-PRETO-001',
    supplier_sku: null,
    color_code: 'PRETO',
    color_name: 'Preto Mock',
    color_hex: '#1a1a1a',
    size_code: null,
    stock_quantity: 0,
    selected_thumbnail: null,
    images: null,
    bitrix_product_id: null,
    is_active: true,
    updated_at: NOW,
  };

  // Only intercept single-product requests (`eq.` filter), not batch (`in.` filter).
  const singleProductRe = new RegExp(
    `\\/rest\\/v1\\/product_variants.*product_id=eq\\.${productId.replace(/-/g, '\\-')}`,
  );

  await page.route(singleProductRe, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const rows = [MOCK_ROW];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': `0-0/1`,
        'access-control-expose-headers': 'content-range',
      },
      body: JSON.stringify(rows),
    });
  });
}
