import { describe, it } from 'https://deno.land/std@0.224.0/testing/bdd.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolveTableAlias, mapProductRowToLegacyShape } from '../_shared/external-db-aliases.ts';

describe('external-db-bridge sanitization & mapping', () => {
  
  it('should sanitize orderBy for products table', () => {
    // Test mapping: supplier_name -> brand
    const result1 = resolveTableAlias('products', {}, { column: 'supplier_name', ascending: true });
    assertEquals(result1.orderBy?.column, 'brand');

    // Test nonexistent column fallback: image_url -> id (since no mapping exists)
    const result2 = resolveTableAlias('products', {}, { column: 'image_url', ascending: false });
    assertEquals(result2.orderBy?.column, 'id');

    // Test allowed column remains unchanged
    const result3 = resolveTableAlias('products', {}, { column: 'name', ascending: true });
    assertEquals(result3.orderBy?.column, 'name');
  });

  it('should rewrite filters with ilike suffixes', () => {
    const filters = {
      'supplier_name_ilike': '%test%',
      'image_url_ilike': '%something%', // Should be removed as it's in PRODUCT_COLUMNS_NOT_IN_EXTERNAL_SCHEMA and no rename exists
      'name_ilike': '%prod%'
    };
    
    const result = resolveTableAlias('products', filters);
    const resFilters = result.filters as any;
    assertEquals(resFilters['brand_ilike'], '%test%');
    assertEquals(resFilters['supplier_name_ilike'], undefined);
    assertEquals(resFilters['image_url_ilike'], undefined);
    assertEquals(resFilters['name_ilike'], '%prod%');
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
    assertEquals(mapped.supplier_name, 'My Brand');
    assertEquals(mapped.image_url, 'https://example.com/img.jpg');
    assertEquals(mapped.country_of_origin, 'Brazil');
    
    // New fields preserved
    assertEquals(mapped.brand, 'My Brand');
    assertEquals(mapped.primary_image_url, 'https://example.com/img.jpg');
    assertEquals(mapped.origin_country, 'Brazil');
  });
});
