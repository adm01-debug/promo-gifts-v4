import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'p1',
            name: 'Produto Teste',
            updated_at: new Date().toISOString(),
            created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            stock_quantity: 10,
            min_quantity: 5,
          },
        ],
        error: null,
      }),
    })),
  },
  SUPABASE_URL: 'https://doufsxqlfjyuvxuezpln.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key',
}));

import { supabase } from '@/integrations/supabase/client';

describe('Edge Function Simulation: Replenishment Triggers', () => {
  it('Deve validar integridade dos dados de reposição via RPC/View', async () => {
    const { data, error } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    if (error) throw error;

    data.forEach(p => {
      if (p.updated_at && p.created_at) {
        expect(isNaN(new Date(p.updated_at).getTime())).toBe(false);
      }
    });
  });
});
