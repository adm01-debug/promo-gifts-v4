/**
 * Fixture determinística para o cenário out-of-stock do color-swatch-sweep.spec.ts.
 *
 * Intercepta /rest/v1/product_variants e injeta uma variante "Preto Mock"
 * com stock_quantity=0 para o productId fornecido, permitindo que o spec
 * valide o layout e a interatividade de swatches esgotados sem depender do
 * seed do banco de dados.
 */
import type { Page, Route } from '@playwright/test';

interface MockVariantRow {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  color_id: string | null;
  color_name: string | null;
  color_hex: string | null;
  color_code: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  updated_at: string;
}

export async function installColorStockMock(
  page: Page,
  { productId }: { productId: string },
): Promise<void> {
  const mockVariant: MockVariantRow = {
    id: `mock-v-${productId.slice(0, 8)}-preto`,
    product_id: productId,
    sku: `MOCK-PRETO-${productId.slice(0, 8)}`,
    name: 'Preto Mock',
    color_id: null,
    color_name: 'Preto Mock',
    color_hex: '#111111',
    color_code: null,
    stock_quantity: 0,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const rows: MockVariantRow[] = [mockVariant];

  await page.route(/\/rest\/v1\/product_variants(\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = route.request().url();
    if (!url.includes(productId)) return route.fallback();
    const body = JSON.stringify(rows);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-range': '0-0/1',
        'access-control-expose-headers': 'content-range',
      },
      body,
    });
  });

  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__E2E_COLOR_STOCK_MOCK__ = true;
  });
}
