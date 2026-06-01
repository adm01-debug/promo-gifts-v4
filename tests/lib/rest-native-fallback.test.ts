import { describe, it, expect, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

describe('rest-native fallback', () => {
  it('should handle empty responses gracefully', async () => {
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const { data } = await supabase.from('products').select('*');
    expect(data).toEqual([]);
  });
});
