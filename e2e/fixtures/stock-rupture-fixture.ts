/**
 * Fixture determinística para specs de Risco de Ruptura.
 *
 * Intercepta os 6 endpoints REST reais consumidos por `stockFetcher.ts`:
 *   - /rest/v1/v_products_public          (alias Gold de `products`)
 *   - /rest/v1/product_variants
 *   - /rest/v1/variant_supplier_sources
 *   - /rest/v1/categories
 *   - /rest/v1/v_suppliers_public         (alias Gold de `suppliers`)
 *   - /rest/v1/product_images
 *
 * Serve um catálogo mínimo de 3 produtos/variantes que exercitam:
 *  - HEALTHY: estoque alto, baixa baixa → never low_stock
 *  - AT_RISK_30D: dispara apenas no horizonte 30d com alvo ≥ 500
 *  - MISSING_FIELDS: current/min/max nulos → fallback estático sem crash
 *
 * Avg daily depletion é simulado via `next_quantity_*` em
 * `variant_supplier_sources` (a Inteligência de Mercado deriva daí).
 */
import type { Page, Route } from '@playwright/test';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  min_quantity: number | null;
  stock_quantity: number | null;
  updated_at: string;
  category_id: string;
  supplier_id: string;
  brand: string | null;
  active: boolean;
}
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
interface SupplierSourceRow {
  id: string;
  variant_id: string;
  supplier_id: string;
  supplier_sku: string;
  quantity: number;
  next_quantity_1: number | null;
  next_date_1: string | null;
  next_quantity_2: number | null;
  next_date_2: string | null;
  next_quantity_3: number | null;
  next_date_3: string | null;
  is_active: boolean;
  updated_at: string;
}

const NOW = '2026-06-17T00:00:00Z';
const CAT_ID = 'fx-cat-1';
const SUP_ID = 'fx-sup-1';

export const FX_PRODUCTS: ProductRow[] = [
  { id: 'fx-p-healthy', name: '[FX] Caneta Saudável', sku: 'FX-HEALTHY-001', min_quantity: 100, stock_quantity: 5000, updated_at: NOW, category_id: CAT_ID, supplier_id: SUP_ID, brand: 'FX', active: true },
  { id: 'fx-p-risk', name: '[FX] Caneca Risco 30d', sku: 'FX-RISK-001', min_quantity: 50, stock_quantity: 800, updated_at: NOW, category_id: CAT_ID, supplier_id: SUP_ID, brand: 'FX', active: true },
  { id: 'fx-p-missing', name: '[FX] Mochila Sem Dados', sku: 'FX-MISSING-001', min_quantity: null, stock_quantity: null, updated_at: NOW, category_id: CAT_ID, supplier_id: SUP_ID, brand: 'FX', active: true },
];

export const FX_VARIANTS: VariantRow[] = [
  { id: 'fx-v-healthy', product_id: 'fx-p-healthy', sku: 'FX-HEALTHY-001-A', name: 'Azul', color_id: null, color_name: 'Azul', color_hex: '#3b82f6', color_code: null, stock_quantity: 5000, is_active: true, updated_at: NOW },
  { id: 'fx-v-risk', product_id: 'fx-p-risk', sku: 'FX-RISK-001-A', name: 'Branca', color_id: null, color_name: 'Branca', color_hex: '#ffffff', color_code: null, stock_quantity: 800, is_active: true, updated_at: NOW },
  { id: 'fx-v-missing', product_id: 'fx-p-missing', sku: 'FX-MISSING-001-A', name: 'Preta', color_id: null, color_name: 'Preta', color_hex: '#000000', color_code: null, stock_quantity: null, is_active: true, updated_at: NOW },
];

export const FX_SUPPLIER_SOURCES: SupplierSourceRow[] = [
  // Healthy: baixa diária ~ (5000→4985)/3d ≈ 5/dia
  { id: 'fx-ss-healthy', variant_id: 'fx-v-healthy', supplier_id: SUP_ID, supplier_sku: 'FX-HEALTHY-001-A', quantity: 5000, next_quantity_1: 4985, next_date_1: '2026-06-20', next_quantity_2: 4970, next_date_2: '2026-06-23', next_quantity_3: 4955, next_date_3: '2026-06-26', is_active: true, updated_at: NOW },
  // Risk: 800 → 740 em 3d (~20/dia); em 30d projetaria 200
  { id: 'fx-ss-risk', variant_id: 'fx-v-risk', supplier_id: SUP_ID, supplier_sku: 'FX-RISK-001-A', quantity: 800, next_quantity_1: 740, next_date_1: '2026-06-20', next_quantity_2: 680, next_date_2: '2026-06-23', next_quantity_3: 620, next_date_3: '2026-06-26', is_active: true, updated_at: NOW },
  // Missing: tudo nulo
  { id: 'fx-ss-missing', variant_id: 'fx-v-missing', supplier_id: SUP_ID, supplier_sku: 'FX-MISSING-001-A', quantity: 0, next_quantity_1: null, next_date_1: null, next_quantity_2: null, next_date_2: null, next_quantity_3: null, next_date_3: null, is_active: true, updated_at: NOW },
];

const FX_CATEGORIES = [{ id: CAT_ID, name: 'Brindes FX' }];
const FX_SUPPLIERS = [{ id: SUP_ID, name: 'FX Fornecedor Único', code: 'FX' }];
const FX_IMAGES: unknown[] = [];

const ROUTE_MAP: Array<{ match: RegExp; rows: unknown[] }> = [
  { match: /\/rest\/v1\/v_products_public(\?|$)/, rows: FX_PRODUCTS },
  { match: /\/rest\/v1\/products(\?|$)/, rows: FX_PRODUCTS },
  { match: /\/rest\/v1\/product_variants(\?|$)/, rows: FX_VARIANTS },
  { match: /\/rest\/v1\/variant_supplier_sources(\?|$)/, rows: FX_SUPPLIER_SOURCES },
  { match: /\/rest\/v1\/categories(\?|$)/, rows: FX_CATEGORIES },
  { match: /\/rest\/v1\/v_suppliers_public(\?|$)/, rows: FX_SUPPLIERS },
  { match: /\/rest\/v1\/suppliers(\?|$)/, rows: FX_SUPPLIERS },
  { match: /\/rest\/v1\/product_images(\?|$)/, rows: FX_IMAGES },
];

export async function installRuptureFixture(page: Page): Promise<void> {
  for (const { match, rows } of ROUTE_MAP) {
    await page.route(match, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const body = JSON.stringify(rows);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
          'access-control-expose-headers': 'content-range',
        },
        body,
      });
    });
  }

  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__E2E_RUPTURE_FIXTURE__ = true;
  });
}
