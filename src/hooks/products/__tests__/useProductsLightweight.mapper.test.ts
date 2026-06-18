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

  // REGRESSÃO — toggles "Destaques", "Promoções", "Com Personalização" e
  // "Com Embalagem Nativa" do Super Filtro. Estes campos eram hardcoded
  // (featured/onSale=false) ou ausentes do mapeamento, deixando os filtros
  // inertes (sempre 0 resultados) apesar de milhares de produtos qualificados.
  it('mapeia featured a partir de is_featured', () => {
    expect(mapLightweightToProduct({ ...baseProduct, is_featured: true }).featured).toBe(true);
    expect(mapLightweightToProduct({ ...baseProduct, is_featured: false }).featured).toBe(false);
  });

  it('mapeia featured também a partir de is_bestseller (espelha product-mapper)', () => {
    expect(mapLightweightToProduct({ ...baseProduct, is_bestseller: true }).featured).toBe(true);
  });

  it('mapeia onSale a partir de is_on_sale', () => {
    expect(mapLightweightToProduct({ ...baseProduct, is_on_sale: true }).onSale).toBe(true);
    expect(mapLightweightToProduct({ ...baseProduct }).onSale).toBe(false);
  });

  it('mapeia hasPersonalization a partir de allows_personalization', () => {
    expect(
      mapLightweightToProduct({ ...baseProduct, allows_personalization: true }).hasPersonalization,
    ).toBe(true);
  });

  it('mapeia hasCommercialPackaging a partir de has_commercial_packaging', () => {
    expect(
      mapLightweightToProduct({ ...baseProduct, has_commercial_packaging: true })
        .hasCommercialPackaging,
    ).toBe(true);
  });

  it('inclui os flags de opções rápidas no select do catálogo leve', () => {
    for (const field of [
      'is_featured',
      'is_bestseller',
      'is_on_sale',
      'allows_personalization',
      'has_commercial_packaging',
    ]) {
      expect(PRODUCT_SELECT_LIGHTWEIGHT).toContain(field);
    }
  });
});
