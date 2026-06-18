/**
 * Testes — useSupplierSalesRanking
 * Invariantes: avg_depletion_7d→velocity7d, graceful fallback, limit 20000
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSupplierSalesRanking } from '../useSupplierSalesRanking';
import { logger } from '@/lib/logger';

const mockDbInvoke = vi.fn();

vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (...args: unknown[]) => mockDbInvoke(...args),
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
    mockDbInvoke.mockResolvedValue({ records: [
      { product_id: 'p1', turnover_score: 0.85, avg_depletion_7d: 3.2, avg_depletion_30d: 12.5, abc_classification: 'A', total_depleted_30d: 100 }
    ] });
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
    mockDbInvoke.mockResolvedValue({ records: [
      { product_id: 'aaa', turnover_score: 1, avg_depletion_7d: 2, avg_depletion_30d: 3, abc_classification: 'B', total_depleted_30d: 10 },
      { product_id: 'bbb', turnover_score: 0.5, avg_depletion_7d: 0, avg_depletion_30d: 1, abc_classification: 'C', total_depleted_30d: 0 },
    ] });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(2);
    expect(result.current.data!.has('aaa')).toBe(true);
  });
});

describe('defaults e limpeza', () => {
  it('usa 0 como default para campos null', async () => {
    mockDbInvoke.mockResolvedValue({ records: [
      { product_id: 'p1', turnover_score: null, avg_depletion_7d: null, avg_depletion_30d: null, abc_classification: null, total_depleted_30d: null }
    ] });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const e = result.current.data!.get('p1')!;
    expect(e.turnoverScore).toBe(0);
    expect(e.velocity7d).toBe(0);
    expect(e.abcClass).toBe('C');
  });

  it('ignora linhas sem product_id', async () => {
    mockDbInvoke.mockResolvedValue({ records: [
      { product_id: null, turnover_score: 1, avg_depletion_7d: 1, avg_depletion_30d: 1, abc_classification: 'A', total_depleted_30d: 1 },
      { product_id: 'p1', turnover_score: 0.5, avg_depletion_7d: 0, avg_depletion_30d: 0, abc_classification: 'B', total_depleted_30d: 0 },
    ] });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(1);
  });
});

describe('graceful fallback MV nao populada', () => {
  it.each([['not been populated'], ['não mapeada'], ['does not exist']])(
    'retorna Map vazia quando erro: %s',
    async (errMsg) => {
      mockDbInvoke.mockRejectedValue(new Error(errMsg));
      const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.size).toBe(0);
      expect(vi.mocked(logger.warn)).toHaveBeenCalled();
    }
  );

  it('re-lanca erros nao relacionados MV', async () => {
    mockDbInvoke.mockRejectedValue(new Error('connection timeout'));
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect((result.current.error as Error).message).toBe('connection timeout');
  });
});

describe('invariantes de chamada ao dbInvoke', () => {
  it('usa limit 20000 (fix: era 5000 que truncava MV)', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    expect(mockDbInvoke.mock.calls[0][0].limit).toBe(20000);
    expect(mockDbInvoke.mock.calls[0][0].table).toBe('mv_product_intelligence');
  });

  it('select usa avg_depletion_* (nao avg_velocity_* que nao existem)', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    const { select } = mockDbInvoke.mock.calls[0][0];
    expect(select).toContain('avg_depletion_7d');
    expect(select).not.toContain('avg_velocity');
  });

  it('retorna Map vazia quando records vazio', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    const { result } = renderHook(() => useSupplierSalesRanking(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.size).toBe(0);
  });
});
