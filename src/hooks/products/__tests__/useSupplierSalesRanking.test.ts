/**
 * Testes — useSupplierSalesRanking
 * Invariantes: avg_depletion_7d→velocity7d, graceful fallback, RPC fn_get_product_intelligence_all
 *
 * FIX BUG-A: hook migrado de dbInvoke (limitado a 1000 rows por PostgREST max_rows)
 * para supabase.rpc() que bypassa o limite e retorna todas as 7 243+ linhas.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSupplierSalesRanking } from '../useSupplierSalesRanking';
import { logger } from '@/lib/logger';

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

describe('mapeamento de colunas (anti-regressao)', () => {
  it('mapeia avg_depletion_7d velocity7d e avg_depletion_30d velocity30d', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          product_id: 'p1',
          turnover_score: 0.85,
          avg_depletion_7d: 3.2,
          avg_depletion_30d: 12.5,
          abc_classification: 'A',
          total_depleted_30d: 100,
          total_depleted_90d: 300,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const e = result.current.data!.get('p1')!;
    expect(e.velocity7d).toBe(3.2);
    expect(e.velocity30d).toBe(12.5);
    expect(e.turnoverScore).toBe(0.85);
    expect(e.abcClass).toBe('A');
    expect(e.depleted30d).toBe(100);
  });

  it('retorna Map com chave product_id', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          product_id: 'aaa',
          turnover_score: 1,
          avg_depletion_7d: 2,
          avg_depletion_30d: 3,
          abc_classification: 'B',
          total_depleted_30d: 10,
          total_depleted_90d: 30,
        },
        {
          product_id: 'bbb',
          turnover_score: 0.5,
          avg_depletion_7d: 0,
          avg_depletion_30d: 1,
          abc_classification: 'C',
          total_depleted_30d: 0,
          total_depleted_90d: 0,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(2);
    expect(result.current.data!.has('aaa')).toBe(true);
  });
});

describe('defaults e limpeza', () => {
  it('usa 0 como default para campos null', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          product_id: 'p1',
          turnover_score: null,
          avg_depletion_7d: null,
          avg_depletion_30d: null,
          abc_classification: null,
          total_depleted_30d: null,
          total_depleted_90d: null,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const e = result.current.data!.get('p1')!;
    expect(e.turnoverScore).toBe(0);
    expect(e.velocity7d).toBe(0);
    expect(e.abcClass).toBe('C');
  });

  it('ignora linhas sem product_id', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          product_id: null,
          turnover_score: 1,
          avg_depletion_7d: 1,
          avg_depletion_30d: 1,
          abc_classification: 'A',
          total_depleted_30d: 1,
          total_depleted_90d: 1,
        },
        {
          product_id: 'p1',
          turnover_score: 0.5,
          avg_depletion_7d: 0,
          avg_depletion_30d: 0,
          abc_classification: 'B',
          total_depleted_30d: 0,
          total_depleted_90d: 0,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(1);
  });
});

describe('graceful fallback MV nao populada', () => {
  it.each([['not been populated'], ['não mapeada'], ['does not exist']])(
    'retorna Map vazia quando erro RPC: %s',
    async (errMsg) => {
      mockRpc.mockResolvedValue({ data: null, error: { message: errMsg } });
      const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.size).toBe(0);
      expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    },
  );

  it('re-lanca erros nao relacionados MV', async () => {
    mockRpc.mockRejectedValue(new Error('connection timeout'));
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect((result.current.error as Error).message).toBe('connection timeout');
  });
});

describe('invariantes de chamada via RPC (fix BUG-A)', () => {
  it('chama fn_get_product_intelligence_all — bypassa max_rows do PostgREST', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc.mock.calls[0][0]).toBe('fn_get_product_intelligence_all');
  });

  it('retorna Map vazia quando data vazia', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(0);
  });
});
