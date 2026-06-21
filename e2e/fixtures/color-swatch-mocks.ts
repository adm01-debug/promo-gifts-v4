/**
 * Fixture determinística para specs de bolinha-de-cor (color swatch).
 *
 * Intercepta os endpoints consumidos por `useExternalVariantStock`:
 *   - GET /rest/v1/product_variants?product_id=eq.{productId}&...
 *   - GET /rest/v1/product_images?product_id=eq.{productId}&...
 *
 * Injeta um catálogo mínimo para um único produto:
 *   - "Azul Mock"  → stock 50   (in-stock)
 *   - "Preto Mock" → stock 0    (out-of-stock) ← usado pelo spec para validar data-stock-state="out"
 *
 * Desta forma os testes de out-of-stock são determinísticos e não dependem
 * do seed real do banco de dados.
 */
import type { Page, Route } from '@playwright/test';

interface MockVariantRow {
  id: string;
  product_id: string;
  sku: string;
  supplier_sku: string | null;
  color_code: string | null;
  color_name: string | null;
  color_hex: string | null;
  size_code: string | null;
  stock_quantity: number | null;
  selected_thumbnail: string | null;
  images: string[] | null;
  bitrix_product_id: string | number | null;
  is_active: boolean;
}

interface InstallOptions {
  productId: string;
}

function makeVariants(productId: string): MockVariantRow[] {
  return [
    {
      id: `mock-v-blue-${productId}`,
      product_id: productId,
      sku: `MOCK-BLUE-${productId}`,
      supplier_sku: null,
      color_code: null,
      color_name: 'Azul Mock',
      color_hex: '#3b82f6',
      size_code: null,
      stock_quantity: 50,
      selected_thumbnail: null,
      images: null,
      bitrix_product_id: null,
      is_active: true,
    },
    {
      id: `mock-v-black-${productId}`,
      product_id: productId,
      sku: `MOCK-BLACK-${productId}`,
      supplier_sku: null,
      color_code: null,
      color_name: 'Preto Mock',
      color_hex: '#111111',
      size_code: null,
      stock_quantity: 0,
      selected_thumbnail: null,
      images: null,
      bitrix_product_id: null,
      is_active: true,
    },
  ];
}

function fulfill(route: Route, rows: unknown[]): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      'access-control-expose-headers': 'content-range',
    },
    body: JSON.stringify(rows),
  });
}

export async function installColorStockMock(page: Page, { productId }: InstallOptions): Promise<void> {
  const variants = makeVariants(productId);

  await page.route(/\/rest\/v1\/product_variants(\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = route.request().url();
    if (!url.includes(`product_id=eq.${productId}`)) return route.fallback();
    await fulfill(route, variants);
  });

  await page.route(/\/rest\/v1\/product_images(\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = route.request().url();
    if (!url.includes(`product_id=eq.${productId}`)) return route.fallback();
    await fulfill(route, []);
  });
}
