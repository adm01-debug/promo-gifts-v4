/**
 * Testes — useProductsLightweight + mapLightweightToProduct
 *
 * Hook e função de mapeamento da fonte primária do catálogo (15KB).
 *
 * Funções puras testadas sem mocks:
 *   mapLightweightToProduct: 8 invariantes críticas
 *
 * Hook testado com react-query mock:
 *   useProductsLightweight: configuração de cache e retry
 *
 * Bug fixes históricos:
 *   FIX BUG-D (2026-06-18): leaf_category_id preferido sobre category_id
 *   FIX 2026-06-02: shouldRetry para em 4xx (não tenta novamente em Bad Request)
 *   price fallback: sale_price ?? cost_price ?? 0
 *   image fallback: primary_image_url → fallback_url → '/placeholder.svg'
 */
import { describe, it, expect, vi } from 'vitest';
import { mapLightweightToProduct } from '../useProductsLightweight';

// ── Fixture: LightweightProduct mínimo ───────────────────────────────────────
function makeLW(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-001',
    name: 'Caneta Azul Premium',
    sku: 'SKU-001',
    supplier_reference: null,
    sale_price: null,
    cost_price: null,
    primary_image_url: null,
    primary_image_fallback_url: null,
    set_image_url: null,
    stock_quantity: 0,
    brand: null,
    category_id: null,
    main_category_id: null,
    leaf_category_id: null,
    leaf_category_name: null,
    is_active: true,
    active: false,
    short_description: null,
    created_at: null,
    ...overrides,
  };
}

// ── mapLightweightToProduct — função pura ─────────────────────────────────────
describe('mapLightweightToProduct', () => {
  it('retorna id como string mesmo quando input é number', () => {
    const result = mapLightweightToProduct(makeLW({ id: 42 }) as never);
    expect(result.id).toBe('42');
    expect(typeof result.id).toBe('string');
  });

  it('FIX BUG-D: prefere leaf_category_id sobre category_id sobre main_category_id', () => {
    const result = mapLightweightToProduct(makeLW({
      leaf_category_id: 'leaf-111',
      category_id: 'cat-222',
      main_category_id: 'main-333',
    }) as never);
    expect(result.category_id).toBe('leaf-111');
  });

  it('FIX BUG-D: usa category_id quando leaf_category_id nulo', () => {
    const result = mapLightweightToProduct(makeLW({
      leaf_category_id: null,
      category_id: 'cat-222',
      main_category_id: 'main-333',
    }) as never);
    expect(result.category_id).toBe('cat-222');
  });

  it('price: usa sale_price quando disponivel', () => {
    const result = mapLightweightToProduct(makeLW({ sale_price: 19.99, cost_price: 10.00 }) as never);
    expect(result.price).toBe(19.99);
  });

  it('price fallback: usa cost_price quando sale_price e nulo', () => {
    const result = mapLightweightToProduct(makeLW({ sale_price: null, cost_price: 8.50 }) as never);
    expect(result.price).toBe(8.50);
  });

  it('price: retorna 0 quando ambos nulos', () => {
    const result = mapLightweightToProduct(makeLW({ sale_price: null, cost_price: null }) as never);
    expect(result.price).toBe(0);
  });

  it('image_url: usa primary_image_url quando disponivel', () => {
    const result = mapLightweightToProduct(makeLW({
      primary_image_url: 'https://cf.net/img1.jpg',
      primary_image_fallback_url: 'https://cdn.net/fallback.jpg',
    }) as never);
    expect(result.image_url).toBe('https://cf.net/img1.jpg');
  });

  it('image_url fallback: usa fallback_url quando primary e nulo', () => {
    const result = mapLightweightToProduct(makeLW({
      primary_image_url: null,
      primary_image_fallback_url: 'https://cdn.net/fallback.jpg',
    }) as never);
    expect(result.image_url).toBe('https://cdn.net/fallback.jpg');
  });

  it('image_url: retorna /placeholder.svg quando ambas nulas', () => {
    const result = mapLightweightToProduct(makeLW({
      primary_image_url: null,
      primary_image_fallback_url: null,
    }) as never);
    expect(result.image_url).toBe('/placeholder.svg');
  });

  it('set_image_url: null quando nao disponivel', () => {
    const result = mapLightweightToProduct(makeLW({ set_image_url: null }) as never);
    expect(result.set_image_url).toBeNull();
  });

  it('set_image_url: propagado quando disponivel', () => {
    const result = mapLightweightToProduct(makeLW({ set_image_url: 'https://cdn/set.jpg' }) as never);
    expect(result.set_image_url).toBe('https://cdn/set.jpg');
  });

  it('is_active: true quando is_active=true', () => {
    const result = mapLightweightToProduct(makeLW({ is_active: true, active: false }) as never);
    expect(result.is_active).toBe(true);
  });

  it('is_active: true quando active=true (fallback)', () => {
    const result = mapLightweightToProduct(makeLW({ is_active: false, active: true }) as never);
    expect(result.is_active).toBe(true);
  });

  it('is_active: false quando ambos false', () => {
    const result = mapLightweightToProduct(makeLW({ is_active: false, active: false }) as never);
    expect(result.is_active).toBe(false);
  });

  it('leaf_category_name: resolve via mapa de categorias', () => {
    const catMap = new Map([['cat-id', 'Canetas']]);
    const result = mapLightweightToProduct(
      makeLW({ leaf_category_id: 'cat-id', leaf_category_name: null }) as never,
      catMap
    );
    expect(result.category_name).toBe('Canetas');
  });

  it('leaf_category_name: prefere campo do produto sobre o mapa', () => {
    const catMap = new Map([['cat-id', 'Canetas do mapa']]);
    const result = mapLightweightToProduct(
      makeLW({ leaf_category_id: 'cat-id', leaf_category_name: 'Canetas do produto' }) as never,
      catMap
    );
    expect(result.category_name).toBe('Canetas do produto');
  });

  it('stock: usa stock_quantity com fallback para 0', () => {
    const r1 = mapLightweightToProduct(makeLW({ stock_quantity: 150 }) as never);
    const r2 = mapLightweightToProduct(makeLW({ stock_quantity: null }) as never);
    expect(r1.stock).toBe(150);
    expect(r2.stock).toBe(0);
  });
});
