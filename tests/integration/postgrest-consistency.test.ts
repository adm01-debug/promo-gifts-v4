import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbInvoke } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';

/**
 * Consistency contract for the direct-PostgREST helper (`dbInvoke`):
 *  - PT-named tables remap their rows back to EN keys (mapRows)
 *  - limit/offset map to an inclusive `.range(offset, offset + limit - 1)`
 *
 * dbInvoke queries via `untypedFrom(table)`, which dereferences
 * `supabase.from` at call time, so spying on `supabase.from` intercepts it.
 */
beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PostgREST consistent behavior', () => {
  it('should remap PT columns correctly for tabela_preco_gravacao_oficial', async () => {
    const orderFn = vi.fn().mockResolvedValue({
      data: [{ id: 'tech-1', nome: 'Serigrafia', ativo: true, codigo_tabela: 'SR' }],
      error: null,
      count: 1,
    });
    const selectFn = vi.fn().mockReturnValue({ order: orderFn });
    vi.spyOn(supabase, 'from').mockReturnValue({ select: selectFn } as never);

    const result = await dbInvoke<Record<string, unknown>>({
      table: 'tabela_preco_gravacao_oficial',
      operation: 'select',
      orderBy: { column: 'name', ascending: true },
    });

    // mapRows aliases PT columns back to EN keys
    expect(result.records[0]).toHaveProperty('name', 'Serigrafia');
    expect(result.records[0]).toHaveProperty('is_active', true);
    expect(result.records[0]).toHaveProperty('table_code', 'SR');
  });

  it('should handle pagination ranges correctly', async () => {
    const rangeFn = vi.fn().mockResolvedValue({ data: [], error: null, count: 100 });
    const selectFn = vi.fn().mockReturnValue({ range: rangeFn });
    vi.spyOn(supabase, 'from').mockReturnValue({ select: selectFn } as never);

    await dbInvoke({ table: 'products', operation: 'select', offset: 20, limit: 10 });

    // range is inclusive: offset to offset + limit - 1 → (20, 29)
    expect(rangeFn).toHaveBeenCalledWith(20, 29);
  });
});
