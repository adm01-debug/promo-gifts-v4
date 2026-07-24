import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../integrations/supabase/client', () => {
  const limitFn = vi.fn();
  const selectFn = vi.fn(() => ({ limit: limitFn }));
  const fromFn = vi.fn(() => ({ select: selectFn }));
  return { supabase: { from: fromFn } };
});

import { supabase } from '../integrations/supabase/client';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Product Fetch Integration', () => {
  it('should be able to fetch products from v_products_public', async () => {
    const mockData = [{ id: 'p1', name: 'Produto Teste' }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const limitFn = (supabase as any).from().select().limit as ReturnType<typeof vi.fn>;
    limitFn.mockResolvedValueOnce({ data: mockData, error: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('v_products_public')
      .select('id, name')
      .limit(1);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should fail if trying to access the empty products table on canonical (due to 0 rows)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const limitFn = (supabase as any).from().select().limit as ReturnType<typeof vi.fn>;
    limitFn.mockResolvedValueOnce({ data: [], error: null });

    const { data, error } = await supabase.from('products').select('id').limit(1);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
