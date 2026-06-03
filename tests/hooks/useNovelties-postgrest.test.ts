/**
 * Verifies the `invokeExternalDb → supabase.from()` migration of
 * `useNoveltiesWithDetails` preserves the exact PostgREST query contract:
 * the products table alias (products → v_products_public), the active +
 * created_at cutoff filters, descending created_at ordering and the limit
 * mapped to `.range(0, limit-1)`.
 *
 * The hook queries via `untypedFrom(resolveTable(table))` (the supabase-direct
 * pattern), so we mock `@/lib/supabase-untyped` and record the builder chain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

interface Recorded {
  table: string;
  calls: Array<{ m: string; args: unknown[] }>;
}

let recorded: Recorded[];
let nextResult: { data: unknown[] | null; error: { message: string } | null; count: number | null };

vi.mock('@/lib/supabase-untyped', () => {
  const CHAIN_METHODS = [
    'select', 'eq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike', 'neq',
    'not', 'order', 'range', 'insert', 'update', 'delete', 'upsert',
  ];
  return {
    untypedFrom: vi.fn((table: string) => {
      const rec: Recorded = { table, calls: [] };
      recorded.push(rec);
      const builder: Record<string, unknown> = {};
      for (const m of CHAIN_METHODS) {
        builder[m] = vi.fn((...args: unknown[]) => {
          rec.calls.push({ m, args });
          return builder;
        });
      }
      (builder as { then: unknown }).then = (resolve: (v: typeof nextResult) => unknown) =>
        resolve(nextResult);
      return builder;
    }),
  };
});

import { useNoveltiesWithDetails } from '@/hooks/products/useNovelties';

const callsOf = (table: string) => recorded.find((r) => r.table === table)?.calls ?? [];
const callArgs = (table: string, method: string) =>
  callsOf(table).filter((c) => c.m === method).map((c) => c.args);

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

beforeEach(() => {
  recorded = [];
  // Empty DB result → hook falls back to mock data (no further DB calls).
  nextResult = { data: [], error: null, count: 0 };
  vi.clearAllMocks();
});

describe('useNoveltiesWithDetails — PostgREST contract', () => {
  it('queries products (→ v_products_public) with active + created_at cutoff, descending order and limit', async () => {
    const { result } = renderHook(() => useNoveltiesWithDetails({ limit: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // products resolves to the public view
    expect(recorded.map((r) => r.table)).toContain('v_products_public');
    // is_active filter
    expect(callArgs('v_products_public', 'eq')).toContainEqual(['is_active', true]);
    // created_at cutoff via .gte(column, ISO date)
    const gteArgs = callArgs('v_products_public', 'gte')[0];
    expect(gteArgs[0]).toBe('created_at');
    expect(String(gteArgs[1])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // descending created_at ordering
    expect(callArgs('v_products_public', 'order')[0]).toEqual([
      'created_at',
      { ascending: false },
    ]);
    // limit 25 → range(0, 24)
    expect(callArgs('v_products_public', 'range')[0]).toEqual([0, 24]);
  });
});
