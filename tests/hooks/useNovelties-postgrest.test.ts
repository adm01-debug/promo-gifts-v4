/**
 * Verifies the `invokeExternalDb → dbInvoke` migration of `useNoveltiesWithDetails`
 * preserves the exact PostgREST query contract: products table, the active +
 * created_at cutoff filters, descending created_at ordering and the limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const dbInvoke = vi.fn();
vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (...args: unknown[]) => dbInvoke(...args),
  dbInvokeSingle: vi.fn(),
  dbInvokeDelete: vi.fn(),
  dbBatch: vi.fn(),
}));

import { useNoveltiesWithDetails } from '@/hooks/products/useNovelties';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

beforeEach(() => {
  dbInvoke.mockReset();
  // products query returns one active product; enrichment lookups return empty.
  dbInvoke.mockResolvedValue({ records: [], count: 0 });
});

describe('useNoveltiesWithDetails — PostgREST contract', () => {
  it('queries products with the active + created_at cutoff filters and descending order', async () => {
    const { result } = renderHook(() => useNoveltiesWithDetails({ limit: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const productsCall = dbInvoke.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .find((opt) => opt.table === 'products' && opt.operation === 'select');

    expect(productsCall).toBeDefined();
    expect(productsCall!.filters).toMatchObject({ is_active: true });
    expect(String((productsCall!.filters as Record<string, unknown>).created_at)).toMatch(/^gte\./);
    expect(productsCall!.orderBy).toEqual({ column: 'created_at', ascending: false });
    expect(productsCall!.limit).toBe(25);
  });
});
