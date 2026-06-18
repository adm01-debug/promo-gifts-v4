/**
 * Testes — useProductsByMetadata
 *
 * Filtragem server-side via fn_super_filtro_product_ids para metadados
 * que nao sao hidratados no catalogo lightweight: Datas, Tags, Ramos, Segmentos, Publico.
 *
 * Invariantes testadas:
 *   - hasFilter: OR entre grupos (qualquer array nao-vazio => true)
 *   - disabled quando todos arrays vazios: sem RPC call, productIds={} 
 *   - chama RPC com os 5 parametros corretos
 *   - retorna Set<product_id>
 *   - erro: retorna Set vazio sem relançar
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProductsByMetadata } from '../useProductsByMetadata';

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const EMPTY = { datas: [], tags: [], ramos: [], segmentos: [], publico: [] };

beforeEach(() => vi.clearAllMocks());

// -- hasFilter logic ----------------------------------------------------------
describe('hasFilter — OR entre grupos', () => {
  it('false quando todos arrays vazios', () => {
    const { result } = renderHook(() => useProductsByMetadata(EMPTY));
    expect(result.current.hasFilter).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    [{ ...EMPTY, datas: ['natal'] }],
    [{ ...EMPTY, tags: ['uuid-1'] }],
    [{ ...EMPTY, ramos: ['varejo'] }],
    [{ ...EMPTY, segmentos: ['tech'] }],
    [{ ...EMPTY, publico: ['corporativo'] }],
  ])('true quando qualquer grupo nao-vazio: %j', (opts) => {
    const { result } = renderHook(() => useProductsByMetadata(opts as typeof EMPTY));
    expect(result.current.hasFilter).toBe(true);
  });
});

// -- sem filtro ---------------------------------------------------------------
describe('sem filtro ativo', () => {
  it('nao chama supabase.rpc quando todos arrays vazios', () => {
    renderHook(() => useProductsByMetadata(EMPTY));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('productIds e Set vazio quando sem filtro', () => {
    const { result } = renderHook(() => useProductsByMetadata(EMPTY));
    expect(result.current.productIds).toBeInstanceOf(Set);
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- com filtro ativo ---------------------------------------------------------
describe('com filtro ativo', () => {
  it('chama fn_super_filtro_product_ids com os 5 parametros', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const opts = {
      datas: ['natal'],
      tags: ['tag1'],
      ramos: ['varejo'],
      segmentos: ['tech'],
      publico: ['corporativo'],
    };
    renderHook(() => useProductsByMetadata(opts));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());

    const [rpcName, args] = mockRpc.mock.calls[0];
    expect(rpcName).toBe('fn_super_filtro_product_ids');
    expect(args._datas).toEqual(['natal']);
    expect(args._tags).toEqual(['tag1']);
    expect(args._ramos).toEqual(['varejo']);
    expect(args._segmentos).toEqual(['tech']);
    expect(args._publico).toEqual(['corporativo']);
  });

  it('retorna Set com product_ids da resposta RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{ product_id: 'p1' }, { product_id: 'p2' }],
      error: null,
    });
    const { result } = renderHook(() =>
      useProductsByMetadata({ ...EMPTY, publico: ['corporativo'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.has('p1')).toBe(true);
    expect(result.current.productIds.has('p2')).toBe(true);
    expect(result.current.productIds.size).toBe(2);
  });

  it('retorna Set vazio quando data=[] (sem matches)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() =>
      useProductsByMetadata({ ...EMPTY, tags: ['tag-nao-existe'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(0);
  });

  it('data=null trata como array vazio (sem crash)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() =>
      useProductsByMetadata({ ...EMPTY, ramos: ['varejo'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- erro ---------------------------------------------------------------------
describe('tratamento de erro', () => {
  it('retorna Set vazio e nao relanca quando RPC retorna error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const { logger } = await import('@/lib/logger');

    const { result } = renderHook(() =>
      useProductsByMetadata({ ...EMPTY, publico: ['feminino'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(0);
    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });
});
