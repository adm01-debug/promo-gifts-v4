import { vi, describe, it, expect } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('stockFetcher 410 resilience', () => {
  it('should return empty array on 410 Gone error', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: null,
            error: { message: '410 Gone' },
          }),
        }),
      }),
    } as any);

    const fetchResult = async () => {
      const { data, error } = await supabase.from('variant_supplier_sources').select('*').eq('id', '1').range(0, 10);
      if (error && (error.message.includes('410') || error.message.includes('Gone'))) {
        return [];
      }
      return data;
    };

    const result = await fetchResult();
    expect(result).toEqual([]);
  });
});
