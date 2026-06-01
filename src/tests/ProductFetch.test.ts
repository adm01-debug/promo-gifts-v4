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

    // With our canonical fix, this should succeed (no auth error)
    // The view exists and is accessible via RLS
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should fail if trying to access the empty products table on canonical (due to 0 rows)', async () => {
    // This is just to confirm our previous finding that the base table is empty
    const { data, error } = await supabase.from('products').select('id').limit(1);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
