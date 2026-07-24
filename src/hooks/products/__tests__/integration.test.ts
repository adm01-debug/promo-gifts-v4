import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProductVariantsWithStock } from '../useVariantSupplierSources';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// useProductVariantsWithStock queries via supabase.from('product_variants')
// directly (PostgREST embed of variant_supplier_sources), awaiting the chain
// which resolves to { data, error }. Mock that client layer.
let nextResult: { data: unknown[] | null; error: { message: string } | null };

vi.mock('@/integrations/supabase/client', () => {
  const CHAIN_METHODS = ['select', 'eq', 'in', 'is', 'order', 'range', 'limit'];
  return {
    supabase: {
      from: vi.fn(() => {
        const builder: Record<string, unknown> = {};
        for (const m of CHAIN_METHODS) {
          builder[m] = vi.fn(() => builder);
        }
        (builder as { then: unknown }).then = (resolve: (v: typeof nextResult) => unknown) =>
          resolve(nextResult);
        return builder;
      }),
    },
  };
});

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

describe('useProductVariantsWithStock Integration (Mock)', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    });
    nextResult = { data: [], error: null };
    vi.clearAllMocks();
  });

  it('deve formatar corretamente os dados vindo do JOIN com variant_supplier_sources', async () => {
    nextResult = {
      data: [
        {
          id: 'v1',
          product_id: 'p1',
          sku: 'SKU-01',
          color_name: 'Azul',
          variant_supplier_sources: [
            {
              next_date_1: '2026-06-10',
              next_quantity_1: 50,
              next_date_2: '2026-07-15',
              next_quantity_2: 100,
              next_date_3: null,
              next_quantity_3: 0,
            },
          ],
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const variant = result.current.data![0];

    // Verifica mapeamento de compatibilidade
    expect(variant.next_entry_date).toBe('2026-06-10');
    expect(variant.next_entry_quantity).toBe(50);

    // Verifica mapeamento das múltiplas datas
    expect(variant.next_date_1).toBe('2026-06-10');
    expect(variant.next_date_2).toBe('2026-07-15');
    expect(variant.next_date_3).toBe(null);

    expect(variant.next_quantity_1).toBe(50);
    expect(variant.next_quantity_2).toBe(100);
    expect(variant.next_quantity_3).toBe(0);
  });

  it('deve lidar com variant_supplier_sources vazio sem quebrar', async () => {
    nextResult = {
      data: [
        {
          id: 'v2',
          product_id: 'p1',
          sku: 'SKU-02',
          variant_supplier_sources: [],
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const variant = result.current.data![0];
    expect(variant.next_date_1).toBeNull();
    expect(variant.next_entry_date).toBeNull();
  });

  it('deve agrupar corretamente múltiplas variantes da mesma cor', async () => {
    nextResult = {
      data: [
        {
          id: 'v1',
          product_id: 'p1',
          sku: 'SKU-01',
          color_name: 'Azul',
          variant_supplier_sources: [{ next_date_1: '2026-06-10', next_quantity_1: 50 }],
        },
        {
          id: 'v2',
          product_id: 'p1',
          sku: 'SKU-02',
          color_name: 'Azul',
          variant_supplier_sources: [{ next_date_1: '2026-06-15', next_quantity_1: 30 }],
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].color_name).toBe('Azul');
    expect(result.current.data![1].color_name).toBe('Azul');
  });

  it('deve mapear corretamente combinações parciais (alguns campos nulos)', async () => {
    nextResult = {
      data: [
        {
          id: 'v3',
          product_id: 'p1',
          sku: 'SKU-03',
          color_name: 'Verde',
          variant_supplier_sources: [
            {
              next_date_1: '2026-06-10',
              next_quantity_1: 50,
              next_date_2: null,
              next_quantity_2: null,
              next_date_3: '2026-08-20',
              next_quantity_3: 80,
            },
          ],
        },
      ],
      error: null,
    };

    const { result } = renderHook(() => useProductVariantsWithStock('p1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const variant = result.current.data![0];
    expect(variant.next_date_1).toBe('2026-06-10');
    expect(variant.next_quantity_1).toBe(50);
    expect(variant.next_date_2).toBe(null);
    expect(variant.next_quantity_2).toBe(null);
    expect(variant.next_date_3).toBe('2026-08-20');
    expect(variant.next_quantity_3).toBe(80);
  });
});
