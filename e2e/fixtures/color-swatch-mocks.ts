/**
 * Mocks Playwright para garantir cenários determinísticos de cor/estoque
 * nas specs de swatch — independentes do seed do banco.
 *
 * Padrão: intercepta `/rest/v1/product_variants` (Supabase REST) para um
 * `productId` específico e devolve 2 variantes: uma EM ESTOQUE e uma
 * ESGOTADA. As demais requisições passam direto (`route.fallback()`).
 *
 * Uso (dentro de uma spec):
 *   await installColorStockMock(page, { productId: 'abc-123' });
 *   await page.goto('/produtos');
 */
import type { Page } from '@playwright/test';

export interface ColorStockMockOptions {
  productId: string;
  inStockColor?: { name: string; hex: string; qty?: number };
  outOfStockColor?: { name: string; hex: string };
}

const DEFAULTS = {
  inStockColor: { name: 'Azul Mock', hex: '#1e40af', qty: 250 },
  outOfStockColor: { name: 'Preto Mock', hex: '#000000' },
};

/**
 * Intercepta `product_variants` para o produto alvo, devolvendo 2 cores:
 *  - 1 com estoque (qty configurável)
 *  - 1 esgotada (stock_quantity = 0)
 *
 * Robusto a query strings PostgREST (filter `product_id=eq.<id>`).
 */
export async function installColorStockMock(
  page: Page,
  opts: ColorStockMockOptions,
): Promise<void> {
  const inStock = { ...DEFAULTS.inStockColor, ...(opts.inStockColor || {}) };
  const outOfStock = { ...DEFAULTS.outOfStockColor, ...(opts.outOfStockColor || {}) };
  const now = new Date().toISOString();

  await page.route(/\/rest\/v1\/product_variants(\?.*)?$/, async (route) => {
    const url = route.request().url();
    const filterMatch = url.match(/product_id=eq\.([^&]+)/);
    const filteredId = filterMatch ? decodeURIComponent(filterMatch[1]) : null;

    // Só sobrescreve a resposta quando a query é do produto alvo.
    if (filteredId !== opts.productId) {
      return route.fallback();
    }

    const body = [
      {
        id: `mock-${opts.productId}-instock`,
        product_id: opts.productId,
        sku: `MOCK-${opts.productId}-IN`,
        name: inStock.name,
        color_id: null,
        color_name: inStock.name,
        color_hex: inStock.hex,
        color_code: null,
        stock_quantity: inStock.qty ?? 250,
        is_active: true,
        updated_at: now,
      },
      {
        id: `mock-${opts.productId}-out`,
        product_id: opts.productId,
        sku: `MOCK-${opts.productId}-OUT`,
        name: outOfStock.name,
        color_id: null,
        color_name: outOfStock.name,
        color_hex: outOfStock.hex,
        color_code: null,
        stock_quantity: 0,
        is_active: true,
        updated_at: now,
      },
    ];

    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
}
