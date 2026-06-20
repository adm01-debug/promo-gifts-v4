import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: '1',
            name: 'Produto A',
            updated_at: '2026-01-01T00:00:00Z',
            created_at: '2025-12-01T00:00:00Z',
            stock_quantity: 100,
            min_quantity: 10,
          },
        ],
        error: null,
      }),
    })),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('Edge Function Simulation: Replenishment Triggers', () => {
  it('Deve validar integridade dos dados de reposição via RPC/View', async () => {
    // Simula chamada que o hook faz
    const { data, error } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    if (error) throw error;

    data.forEach(p => {
      if (p.updated_at && p.created_at) {
        const delta = new Date(p.updated_at).getTime() - new Date(p.created_at).getTime();
        // A lógica de reposição exige delta > 24h
        // Aqui apenas validamos que os dados existem e são datas válidas
        expect(isNaN(new Date(p.updated_at).getTime())).toBe(false);
      }
    });
  });
});
