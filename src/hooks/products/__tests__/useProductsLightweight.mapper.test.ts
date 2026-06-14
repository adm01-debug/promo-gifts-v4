import { describe, expect, it } from 'vitest';
import {
  mapLightweightToProduct,
  PRODUCT_SELECT_LIGHTWEIGHT,
} from '@/hooks/products/useProductsLightweight';
import type { LightweightProduct } from '@/lib/external-db/products-lightweight';

const baseProduct: LightweightProduct = {
  id: 'produto-teste',
  name: 'Produto Teste',
  sku: 'SKU-TESTE',
  supplier_reference: null,
  sale_price: 10,
  cost_price: 8,
  image_url: null,
  primary_image_url: null,
  set_image_url: null,
  supplier_id: null,
  category_id: null,
  main_category_id: null,
  brand: null,
  is_active: true,
  active: true,
  stock_quantity: 10,
  min_quantity: 1,
  is_kit: false,
  is_new: false,
  created_at: '2026-01-01T00:00:00.000Z',
  gender: null,
  short_description: null,
};

describe('mapLightweightToProduct', () => {
  it('preserva novidade quando o produto vem marcado como is_new', () => {
    const product = mapLightweightToProduct({ ...baseProduct, is_new: true });

    expect(product.newArrival).toBe(true);
  });

  it('marca como novidade quando created_at está dentro da janela de 30 dias', () => {
    const recentDate = new Date(Date.now() - 3 * 86400000).toISOString();
    const product = mapLightweightToProduct({ ...baseProduct, created_at: recentDate });

    expect(product.newArrival).toBe(true);
    expect(product.created_at).toBe(recentDate);
  });

  it('busca is_new e created_at no select do catálogo leve', () => {
    expect(PRODUCT_SELECT_LIGHTWEIGHT).toContain('is_new');
    expect(PRODUCT_SELECT_LIGHTWEIGHT).toContain('created_at');
  });
});