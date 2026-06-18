/**
 * Testes — useProductsByCategory
 *
 * Busca product_ids via Edge Function categories-api.
 * Invariantes:
 *   - hasFilter = categoryIds.length > 0
 *   - enabled=false -> sem invoke
 *   - categoryIds=[] -> sem invoke, Set vazio
 *   - invoca categories-api com action+categoryIds+includeDescendants
 *   - retorna Set de productIds + categoriesCount + source
 *   - erro: error state + Set vazio (key marcada para evitar loop infinito)
 *   - categoryIdsKey e ordenado (estabilidade de cache)
 *   - refetch disponivel
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProductsByCategory } from '../useProductsByCategory';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

// -- hasFilter logic ----------------------------------------------------------
describe('hasFilter', () => {
  it('false quando categoryIds vazio', () => {
    const { result } = renderHook(() => useProductsByCategory({ categoryIds: [] }));
    expect(result.current.hasFilter).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('true quando categoryIds tem itens', () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      useProductsByCategory({ categoryIds: ['cat-1'] })
    );
    expect(result.current.hasFilter).toBe(true);
  });
});

// -- Sem filtro / disabled ----------------------------------------------------
describe('sem invoke quando sem filtro ou disabled', () => {
  it('nao chama functions.invoke quando categoryIds=[]', () => {
    renderHook(() => useProductsByCategory({ categoryIds: [] }));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('nao chama functions.invoke quando enabled=false', () => {
    renderHook(() => useProductsByCategory({ categoryIds: ['cat-1'], enabled: false }));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('productIds = Set vazio, error = null por padrao', () => {
    const { result } = renderHook(() => useProductsByCategory({ categoryIds: [] }));
    expect(result.current.productIds.size).toBe(0);
    expect(result.current.error).toBeNull();
  });
});

// -- Invocacao correta --------------------------------------------------------
describe('invocacao da Edge Function', () => {
  it('invoca categories-api com action, categoryIds e includeDescendants', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, productIds: ['p1'], categoriesUsed: 1, source: 'db' },
      error: null,
    });
    renderHook(() =>
      useProductsByCategory({ categoryIds: ['cat-2', 'cat-1'], includeDescendants: true })
    );
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    const [fnName, opts] = mockInvoke.mock.calls[0];
    expect(fnName).toBe('categories-api');
    expect(opts.body.action).toBe('products_by_categories');
    expect(opts.body.includeDescendants).toBe(true);
    // categoryIds passados (podem estar em qualquer ordem)
    expect(opts.body.categoryIds).toContain('cat-1');
    expect(opts.body.categoryIds).toContain('cat-2');
  });

  it('includeDescendants default = true', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, productIds: [], categoriesUsed: 0, source: null },
      error: null,
    });
    renderHook(() => useProductsByCategory({ categoryIds: ['cat-1'] }));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(mockInvoke.mock.calls[0][1].body.includeDescendants).toBe(true);
  });
});

// -- Retorno correto ----------------------------------------------------------
describe('dados retornados corretamente', () => {
  it('popula productIds, categoriesCount e source', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, productIds: ['p1', 'p2', 'p3'], categoriesUsed: 2, source: 'edge-fn' },
      error: null,
    });
    const { result } = renderHook(() =>
      useProductsByCategory({ categoryIds: ['cat-1'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(3);
    expect(result.current.productIds.has('p1')).toBe(true);
    expect(result.current.categoriesCount).toBe(2);
    expect(result.current.source).toBe('edge-fn');
    expect(result.current.error).toBeNull();
  });
});

// -- Error handling -----------------------------------------------------------
describe('tratamento de erros', () => {
  it('data.success=false seta error state + Set vazio', async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: 'Categoria inexistente' },
      error: null,
    });
    const { result } = renderHook(() =>
      useProductsByCategory({ categoryIds: ['cat-nao-existe'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toContain('Categoria inexistente');
    expect(result.current.productIds.size).toBe(0);
  });

  it('invokeError lanca e seta error state', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Function not found' },
    });
    const { result } = renderHook(() =>
      useProductsByCategory({ categoryIds: ['cat-1'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toContain('Function not found');
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- refetch ------------------------------------------------------------------
describe('refetch', () => {
  it('refetch e uma funcao disponivel no retorno', () => {
    const { result } = renderHook(() =>
      useProductsByCategory({ categoryIds: [] })
    );
    expect(typeof result.current.refetch).toBe('function');
  });
});
