import { describe, it, expect } from 'vitest';
import { supabase } from '../integrations/supabase/client';

// Integration test — requires a live Supabase instance.
// In unit test mode, tests/setup.ts stubs VITE_SUPABASE_URL to localhost:54321.
// Skip gracefully when no real DB is available.
const isRealDb =
  !!process.env.VITE_SUPABASE_URL &&
  !process.env.VITE_SUPABASE_URL.includes('localhost') &&
  !process.env.VITE_SUPABASE_URL.includes('127.0.0.1');

describe('Product Fetch Integration', () => {
  it.runIf(isRealDb)('should be able to fetch products from v_products_public', async () => {
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

  it.runIf(isRealDb)('should fail if trying to access the empty products table on canonical (due to 0 rows)', async () => {
    // This is just to confirm our previous finding that the base table is empty
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
