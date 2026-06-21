/**
 * Fixture determinística para specs de color-swatch (out-of-stock determinístico).
 *
 * installColorStockMock — intercepta /rest/v1/product_variants para um dado
 * productId e injeta uma variante "Preto Mock" com stock_quantity=0, de modo
 * que o componente de bolinha de cor renderize data-stock-state="out"
 * de forma 100% determinística, independente do estado do DB.
 *
 * Uso:
 *   await installColorStockMock(page, { productId: 'abc-123' });
 *   await page.reload();
 *   // agora [data-color-name="Preto Mock"] tem data-stock-state="out"
 */
import type { Page, Route } from '@playwright/test';

interface VariantRow {
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

const NOW = new Date().toISOString();

export async function installColorStockMock(
  page: Page,
  { productId }: { productId: string },
): Promise<void> {
  const mockVariants: VariantRow[] = [
    {
      id: `mock-v-preto-${productId}`,
      product_id: productId,
      sku: `MOCK-PRETO-${productId}`,
      name: 'Preto Mock',
      color_id: null,
      color_name: 'Preto Mock',
      color_hex: '#111111',
      color_code: null,
      stock_quantity: 0,
      is_active: true,
      updated_at: NOW,
    },
  ];

  await page.route(
    /\/rest\/v1\/product_variants(\?|$)/,
    async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const url = route.request().url();
      if (!url.includes(productId)) return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': `0-0/1`,
          'access-control-expose-headers': 'content-range',
        },
        body: JSON.stringify(mockVariants),
      });
    },
  );

  await page.addInitScript((pid: string) => {
    (window as unknown as Record<string, unknown>).__E2E_COLOR_SWATCH_MOCK__ = { productId: pid };
  }, productId);
}
