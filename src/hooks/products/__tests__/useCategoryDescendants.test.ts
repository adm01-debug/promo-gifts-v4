/**
 * Testes — useCategoryDescendants
 *
 * Hook auxiliar que busca descendentes de categorias via Edge Function
 * categories-api (action: 'descendants').
 *
 * Invariantes:
 *   - categoryIds=[] -> descendantIds=[], sem invoke
 *   - estabilidade: chave derivada de categoryIds (ordenada) evita re-fetch
 *     e render-loop mesmo com array inline não-memoizado no caller
 *   - fetchTokenRef descarta respostas supersedidas (race condition)
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCategoryDescendants } from '../useProductsByCategory';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('useCategoryDescendants', () => {
  it('categoryIds=[] retorna [] e nao invoca a Edge Function', () => {
    const { result } = renderHook(() => useCategoryDescendants([]));
    expect(result.current.descendantIds).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('busca descendentes quando ha categorias', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, data: ['desc-1', 'desc-2', 'desc-3'] },
      error: null,
    });
    const { result } = renderHook(() => useCategoryDescendants(['cat-1']));
    await waitFor(() => expect(result.current.descendantIds.length).toBe(3));
    expect(result.current.descendantIds).toContain('desc-1');
    expect(mockInvoke).toHaveBeenCalledWith('categories-api', {
      body: { action: 'descendants', categoryIds: ['cat-1'] },
    });
  });

  it('array inline nao causa render-loop (chave estavel)', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      if (renders > 50) throw new Error('RENDER_LOOP: ' + renders);
      return useCategoryDescendants([]); // novo array a cada render
    });
    expect(result.current.descendantIds).toEqual([]);
    expect(renders).toBeLessThan(10);
  });

  it('mesma chave (ordem diferente) nao re-busca', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, data: ['d1'] }, error: null });
    const { result, rerender } = renderHook(
      ({ ids }) => useCategoryDescendants(ids),
      { initialProps: { ids: ['cat-1', 'cat-2'] } }
    );
    await waitFor(() => expect(result.current.descendantIds.length).toBe(1));
    const before = mockInvoke.mock.calls.length;
    rerender({ ids: ['cat-2', 'cat-1'] }); // mesma chave ordenada
    await new Promise((r) => setTimeout(r, 80));
    expect(mockInvoke.mock.calls.length).toBe(before);
  });

  it('erro da Edge Function nao quebra o hook (descendantIds permanece [])', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useCategoryDescendants(['cat-x']));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(result.current.descendantIds).toEqual([]);
  });
});
