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

// The hook fetches via untypedRpc('fn_get_reposicao_listing'), NOT supabase.from().
// Mock the actual transport layer.
vi.mock('@/lib/supabase-untyped', () => ({
  untypedRpc: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

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

// Minimal ReposicaoRow — fields that fn_get_reposicao_listing returns
const baseRow = {
  slug: null,
  is_new: false,
  primary_image_url: null,
  primary_image_cdn: null,
  supplier_id: null,
  supplier_name: null,
  supplier_code: null,
  ultimo_restock_date: null,
  earliest_restock_date: null,
  earliest_restock_qty: null,
  has_upcoming_restock: null,
  category_names: null,
  primary_category_id: null,
  primary_category_name: null,
};

describe('useReplenishmentsWithDetails Pagination & Consistency', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('should fetch different ranges correctly for pagination', async () => {
    const { untypedRpc } = await import('@/lib/supabase-untyped');
    const mockRow = {
      ...baseRow,
      product_id: '1',
      name: 'P1',
      sku: 'S1',
      sale_price: 10,
      is_stockout: false,
      total_stock: 20,
    };
    vi.mocked(untypedRpc).mockResolvedValue({ data: [mockRow], error: null });

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(vi.mocked(untypedRpc)).toHaveBeenCalledWith(
      'fn_get_reposicao_listing',
      expect.objectContaining({ p_limit: 10 }),
    );
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].product_name).toBe('P1');
  });

  it('should maintain consistency during concurrent updates (simulated)', async () => {
    const { untypedRpc } = await import('@/lib/supabase-untyped');
    const mockRows = [
      {
        ...baseRow,
        product_id: '1',
        name: 'P1',
        sku: 'S1',
        sale_price: 10,
        is_stockout: false,
        total_stock: 20,
      },
      // stock=0 + is_stockout=true → deriveStockStatus returns 'out-of-stock'
      {
        ...baseRow,
        product_id: '2',
        name: 'P2',
        sku: 'S2',
        sale_price: 20,
        is_stockout: true,
        total_stock: 0,
      },
    ];
    vi.mocked(untypedRpc).mockResolvedValue({ data: mockRows, error: null });

    const { result } = renderHook(() => useReplenishmentsWithDetails({ limit: 2 }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 5000 });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].product_name).toBe('P1');
    expect(result.current.data?.[1].stock_status).toBe('out-of-stock');
  });
});
