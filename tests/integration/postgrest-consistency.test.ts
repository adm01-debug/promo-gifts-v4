import { describe, it, expect, vi } from 'vitest';
import { dbInvoke } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';

describe('PostgREST consistent behavior', () => {
  it('should remap PT columns correctly for tabela_preco_gravacao_oficial', async () => {
    // Mock Supabase to return PT names
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'tech-1',
              nome: 'Serigrafia',
              ativo: true,
              codigo_tabela: 'SR'
            }
          ],
          error: null,
          count: 1
        })
      })
    } as any);

    const result = await dbInvoke<any>({
      table: 'tabela_preco_gravacao_oficial',
      operation: 'select',
      orderBy: { column: 'name', ascending: true }
    });

    // Verify it was remapped to EN keys in mapRows
    expect(result.records[0]).toHaveProperty('name', 'Serigrafia');
    expect(result.records[0]).toHaveProperty('is_active', true);
    expect(result.records[0]).toHaveProperty('table_code', 'SR');
  });

  it('should handle pagination ranges correctly', async () => {
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 100
        })
      })
    } as any);

    await dbInvoke({
      table: 'products',
      operation: 'select',
      offset: 20,
      limit: 10
    });

    // range is inclusive: offset to offset + limit - 1
    // 20 to 20 + 10 - 1 = 29
    const lastSelect = fromSpy.mock.results[0].value.select;
    const rangeCall = lastSelect.mock.results[0].value.range;
    expect(rangeCall).toHaveBeenCalledWith(20, 29);
  });
});
