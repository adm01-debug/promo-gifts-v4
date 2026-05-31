import { describe, it, expect } from 'vitest';
import { supabase } from '../integrations/supabase/client';

describe('Product Fetch Integration', () => {
  it('should be able to fetch products from v_products_public', async () => {
    // We use the supabase client which is already fixed in client.ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('v_products_public')
      .select('id, name')
      .limit(1);

    if (error) {
      console.error('Fetch error:', error);
    }

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    // Since we verified manually that v_products_public has data, this should pass
    expect(data!.length).toBeGreaterThan(0);
  });

  it('should fail if trying to access the empty products table on canonical (due to 0 rows)', async () => {
    // This is just to confirm our previous finding that the base table is empty
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
