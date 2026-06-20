/**
 * Verifies the PostgREST query contract of `useNoveltiesWithDetails`.
 *
 * FONTE DA VERDADE = pipeline DB (auditoria Novidades 2026-06-18, P0): a
 * pertinência de "novidade" deixou de ser uma janela `created_at + 30d` e passou
 * a ser as flags da pipeline — `is_new = true` E `novelty_expires_at > now` —
 * ordenadas por `novelty_detected_at` desc. Este contrato exercita justamente
 * essa query (não mais o cutoff por `created_at`), além dos filtros de qualidade
 * (is_active, is_stockout=false, imagem não-nula, sale_price>0) e do limite
 * mapeado para `.range(0, limit-1)`.
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
  it('queries products (→ v_products_public) via pipeline flags (is_new + novelty_expires_at>now), detection-desc order and limit', async () => {
    const { result } = renderHook(() => useNoveltiesWithDetails({ limit: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // products resolves to the public view
    expect(recorded.map((r) => r.table)).toContain('v_products_public');

    // pertinência da pipeline + filtros de qualidade via .eq(...)
    const eqArgs = callArgs('v_products_public', 'eq');
    expect(eqArgs).toContainEqual(['is_active', true]);
    expect(eqArgs).toContainEqual(['is_new', true]);
    expect(eqArgs).toContainEqual(['is_stockout', false]);

    // qualidade: imagem não-nula e preço > 0
    expect(callArgs('v_products_public', 'not')).toContainEqual(['primary_image_url', 'is', null]);
    const gtArgs = callArgs('v_products_public', 'gt');
    expect(gtArgs).toContainEqual(['sale_price', 0]);

    // janela REAL da pipeline: novelty_expires_at > now (ISO), não mais created_at
    const expiresGt = gtArgs.find((a) => a[0] === 'novelty_expires_at');
    expect(expiresGt).toBeDefined();
    expect(String((expiresGt ?? [])[1])).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // ordenação: detecção desc + id asc (paginação estável)
    expect(callArgs('v_products_public', 'order')[0]).toEqual([
      'novelty_detected_at',
      { ascending: false },
    ]);
    expect(callArgs('v_products_public', 'order')[1]).toEqual(['id', { ascending: true }]);

    // limit 25 → range(0, 24)
    expect(callArgs('v_products_public', 'range')[0]).toEqual([0, 24]);

    // contrato antigo (cutoff por created_at) foi REMOVIDO de propósito
    expect(callArgs('v_products_public', 'gte')).toHaveLength(0);
  });
});
