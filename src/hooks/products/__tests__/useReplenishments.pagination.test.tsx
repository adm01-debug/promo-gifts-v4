/**
 * Testes — useReplenishmentsWithDetails (paginação + consistência)
 *
 * Hook migrado de supabase.from() para untypedRpc('fn_get_reposicao_listing').
 * Mock via supabase.rpc (interceptado por untypedRpc internamente).
 *
 * Invariantes:
 *   - retorna array mapeado a partir de ReposicaoRow
 *   - product_name mapeia de r.name
 *   - stock_status deriva de is_stockout/total_stock (só 'in-stock' | 'out-of-stock')
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReplenishmentsWithDetails } from '../useReplenishments';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReplenishmentsWithDetails Pagination & Consistency', () => {
  it('retorna array mapeado a partir de ReposicaoRow (product_name = r.name)', async () => {
    const mockRow = {
      product_id: 'p1',
      name: 'P1',
      slug: null,
      sku: 'S1',
      sale_price: 10,
      is_stockout: false,
      is_new: false,
      total_stock: 20,
      primary_image_url: null,
      primary_image_cdn: null,
      supplier_id: null,
      supplier_name: null,
      supplier_code: null,
      ultimo_restock_date: null,
      earliest_restock_date: null,
      earliest_restock_qty: null,
      has_upcoming_restock: false,
      category_names: null,
      primary_category_id: null,
      primary_category_name: null,
    };

    mockRpc.mockResolvedValue({ data: [mockRow], error: null });

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 10 }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].product_name).toBe('P1');
  });

  it('stock_status é out-of-stock quando is_stockout=true', async () => {
    const mockRows = [
      {
        product_id: 'p1',
        name: 'P1',
        slug: null,
        sku: 'S1',
        sale_price: 10,
        is_stockout: false,
        is_new: false,
        total_stock: 20,
        primary_image_url: null,
        primary_image_cdn: null,
        supplier_id: null,
        supplier_name: null,
        supplier_code: null,
        ultimo_restock_date: null,
        earliest_restock_date: null,
        earliest_restock_qty: null,
        has_upcoming_restock: false,
        category_names: null,
        primary_category_id: null,
        primary_category_name: null,
      },
      {
        product_id: 'p2',
        name: 'P2',
        slug: null,
        sku: 'S2',
        sale_price: 20,
        is_stockout: true,
        is_new: false,
        total_stock: 0,
        primary_image_url: null,
        primary_image_cdn: null,
        supplier_id: null,
        supplier_name: null,
        supplier_code: null,
        ultimo_restock_date: null,
        earliest_restock_date: null,
        earliest_restock_qty: null,
        has_upcoming_restock: false,
        category_names: null,
        primary_category_id: null,
        primary_category_name: null,
      },
    ];

    mockRpc.mockResolvedValue({ data: mockRows, error: null });

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 2 }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].product_name).toBe('P1');
    expect(result.current.data?.[0].stock_status).toBe('in-stock');
    expect(result.current.data?.[1].stock_status).toBe('out-of-stock');
  });
});
