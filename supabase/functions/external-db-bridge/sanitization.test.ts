import { describe, it, expect } from 'https://deno.land/std@0.224.0/testing/bdd.ts';
import { resolveTableAlias, mapProductRowToLegacyShape } from '../_shared/external-db-aliases.ts';

describe('external-db-bridge sanitization & mapping', () => {
  
  it('should sanitize orderBy for products table', () => {
    // Test mapping: supplier_name -> brand
    const result1 = resolveTableAlias('products', {}, { column: 'supplier_name', ascending: true });
    expect(result1.orderBy?.column).toBe('brand');

    // Test nonexistent column fallback: image_url -> id (since no mapping exists)
    const result2 = resolveTableAlias('products', {}, { column: 'image_url', ascending: false });
    expect(result2.orderBy?.column).toBe('id');

    // Test allowed column remains unchanged
    const result3 = resolveTableAlias('products', {}, { column: 'name', ascending: true });
    expect(result3.orderBy?.column).toBe('name');
  });

  it('should rewrite filters with ilike suffixes', () => {
    const filters = {
      'supplier_name_ilike': '%test%',
      'image_url_ilike': '%something%', // Should be removed as it's in PRODUCT_COLUMNS_NOT_IN_EXTERNAL_SCHEMA and no rename exists
      'name_ilike': '%prod%'
    };
    
    const result = resolveTableAlias('products', filters);
    expect(result.filters).toHaveProperty('brand_ilike', '%test%');
    expect(result.filters).not.toHaveProperty('supplier_name_ilike');
    expect(result.filters).not.toHaveProperty('image_url_ilike');
    expect(result.filters).toHaveProperty('name_ilike', '%prod%');
  });

  it('should return both legacy and new fields in mapProductRowToLegacyShape', () => {
    const row = {
      id: '123',
      name: 'Test Product',
      brand: 'My Brand',
      primary_image_url: 'https://example.com/img.jpg',
      origin_country: 'Brazil'
    };

    const mapped = mapProductRowToLegacyShape(row);
    
    // Legacy fields
    expect(mapped.supplier_name).toBe('My Brand');
    expect(mapped.image_url).toBe('https://example.com/img.jpg');
    expect(mapped.country_of_origin).toBe('Brazil');
    
    // New fields preserved
    expect(mapped.brand).toBe('My Brand');
    expect(mapped.primary_image_url).toBe('https://example.com/img.jpg');
    expect(mapped.origin_country).toBe('Brazil');
  });
});
