/**
 * Testes — useProductsBySize + useAvailableSizes (SF-E)
 *
 * O catalogo leve nao carrega variacoes, entao filtragem por tamanho
 * vai via product_variants. Invariantes testadas:
 *
 * useProductsBySize:
 *   - disabled quando sizes=[]: hasFilter=false, sem query ao DB
 *   - retorna Set de product_ids quando sizes fornecidos
 *   - sizeKey e ordenado (estabilidade de cache)
 *   - isLoading=false quando sem filtro
 *
 * useAvailableSizes:
 *   - retorna sizes distintos (deduplicados)
 *   - faz trim de espacos
 *   - retorna [] enquanto carrega
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProductsBySize, useAvailableSizes } from '../useProductsBySize';

const mockDbInvoke = vi.fn();

vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (...args: unknown[]) => mockDbInvoke(...args),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

// -- useProductsBySize -------------------------------------------------------
describe('useProductsBySize', () => {
  it('sizes=[] desativa query: hasFilter=false, sem chamada ao DB', () => {
    mockDbInvoke.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProductsBySize([]), {
      wrapper: makeWrapper(),
    });
    expect(result.current.hasFilter).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockDbInvoke).not.toHaveBeenCalled();
  });

  it('productIds e Set vazio quando sizes=[]', () => {
    const { result } = renderHook(() => useProductsBySize([]), {
      wrapper: makeWrapper(),
    });
    expect(result.current.productIds).toBeInstanceOf(Set);
    expect(result.current.productIds.size).toBe(0);
  });

  it('retorna Set com product_ids (com deduplicacao)', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { product_id: 'p1' },
        { product_id: 'p2' },
        { product_id: 'p1' }, // duplicata
      ],
    });
    const { result } = renderHook(() => useProductsBySize(['M', 'G']), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.has('p1')).toBe(true);
    expect(result.current.productIds.has('p2')).toBe(true);
    expect(result.current.productIds.size).toBe(2);
    expect(result.current.hasFilter).toBe(true);
  });

  it('sizeKey passado ao dbInvoke e ordenado (estabilidade de cache)', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    renderHook(() => useProductsBySize(['G', 'P', 'M']), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    const filters = mockDbInvoke.mock.calls[0][0].filters;
    expect(filters.size_code).toEqual(['G', 'M', 'P']);
  });

  it('ignora records sem product_id', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { product_id: null },
        { product_id: '' },
        { product_id: 'p1' },
      ],
    });
    const { result } = renderHook(() => useProductsBySize(['M']), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(1);
  });
});

// -- useAvailableSizes -------------------------------------------------------
describe('useAvailableSizes', () => {
  it('retorna [] e isLoading=true antes do fetch completar', () => {
    mockDbInvoke.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAvailableSizes(), {
      wrapper: makeWrapper(),
    });
    expect(result.current.sizes).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('retorna sizes distintos (deduplicados)', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { size_code: 'P' },
        { size_code: 'M' },
        { size_code: 'P' },
        { size_code: 'G' },
      ],
    });
    const { result } = renderHook(() => useAvailableSizes(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sizes.sort()).toEqual(['G', 'M', 'P']);
  });

  it('faz trim de espacos nos codes', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [{ size_code: '  M  ' }, { size_code: 'G' }],
    });
    const { result } = renderHook(() => useAvailableSizes(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sizes).toContain('M');
    expect(result.current.sizes).not.toContain('  M  ');
  });

  it('filtra size_code null, vazio e apenas espacos', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { size_code: null },
        { size_code: '' },
        { size_code: '   ' },
        { size_code: 'P' },
      ],
    });
    const { result } = renderHook(() => useAvailableSizes(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sizes).toEqual(['P']);
  });

  it('retorna [] quando records vazio', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    const { result } = renderHook(() => useAvailableSizes(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sizes).toEqual([]);
  });
});
