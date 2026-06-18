/**
 * SF-E — useProductsBySize / useAvailableSizes
 *
 * Trava a construção da query contra product_variants e a transformação dos
 * registros em Set de product IDs / lista de tamanhos distintos.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const dbInvoke = vi.fn();
vi.mock('@/lib/db/postgrest', () => ({ dbInvoke: (args: unknown) => dbInvoke(args) }));

import { useProductsBySize, useAvailableSizes } from '../useProductsBySize';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => dbInvoke.mockReset());

describe('useProductsBySize', () => {
  it('não consulta quando não há tamanhos selecionados', () => {
    const { result } = renderHook(() => useProductsBySize([]), { wrapper: wrapper() });
    expect(result.current.hasFilter).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(dbInvoke).not.toHaveBeenCalled();
  });

  it('consulta product_variants por size_code (IN) e devolve Set de product_ids', async () => {
    dbInvoke.mockResolvedValue({
      records: [{ product_id: 'a' }, { product_id: 'b' }, { product_id: 'a' }],
      count: null,
    });
    const { result } = renderHook(() => useProductsBySize(['M', 'P']), { wrapper: wrapper() });
    expect(result.current.hasFilter).toBe(true);
    await waitFor(() => expect(result.current.productIds.size).toBe(2));
    expect([...result.current.productIds].sort()).toEqual(['a', 'b']);

    const arg = dbInvoke.mock.calls[0][0];
    expect(arg.table).toBe('product_variants');
    expect(arg.select).toBe('product_id');
    expect(arg.filters.is_active).toBe(true);
    // chave estável: ordenada
    expect(arg.filters.size_code).toEqual(['M', 'P']);
  });

  it('usa chave de cache estável independente da ordem de seleção', async () => {
    dbInvoke.mockResolvedValue({ records: [], count: null });
    const { result } = renderHook(() => useProductsBySize(['P', 'M']), { wrapper: wrapper() });
    await waitFor(() => expect(dbInvoke).toHaveBeenCalled());
    expect(dbInvoke.mock.calls[0][0].filters.size_code).toEqual(['M', 'P']);
    expect(result.current.hasFilter).toBe(true);
  });
});

describe('useAvailableSizes', () => {
  it('busca size_code não-nulo (gt "") e devolve tamanhos distintos', async () => {
    dbInvoke.mockResolvedValue({
      records: [
        { size_code: 'M' },
        { size_code: 'M' },
        { size_code: 'G' },
        { size_code: null },
        { size_code: '  ' },
      ],
      count: null,
    });
    const { result } = renderHook(() => useAvailableSizes(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.sizes.length).toBe(2));
    expect(result.current.sizes.sort()).toEqual(['G', 'M']);

    const arg = dbInvoke.mock.calls[0][0];
    expect(arg.table).toBe('product_variants');
    expect(arg.filters.size_code).toEqual({ op: 'gt', value: '' });
  });
});
