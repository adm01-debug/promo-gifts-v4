/**
 * Testes — useProductsByColor (SF-D)
 *
 * Trava BUG-SF-NUANCE (2026-06-18): colorNuances era IGNORADO (zerava resultado).
 * Agora: nuance.slug -> nuance_id -> color_variations.nuance_id -> color_id set.
 *
 * Invariantes:
 *   - hasFilter OR entre 4 grupos
 *   - disabled sem DB call quando todos arrays vazios
 *   - colorVariations: lookup direto por slug -> variation ID
 *   - colorGroups: expande para todas variations do grupo
 *   - colorNuances BUG-SF-NUANCE: resolve via nuance_id
 *   - targetColorIds vazio -> sem query a product_variants
 *   - erro -> Set vazio + logger.error
 */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProductsByColor } from '../useProductsByColor';

const { mockDbInvoke } = vi.hoisted(() => ({
  mockDbInvoke: vi.fn(),
}));

vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (...args: unknown[]) => mockDbInvoke(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Fixtures
const REF_GROUPS = [
  { id: 'grp-azul', slug: 'azul', name: 'Azul' },
  { id: 'grp-verde', slug: 'verde', name: 'Verde' },
];
const REF_VARIATIONS = [
  { id: 'var-azul-royal', slug: 'azul-royal', name: 'Azul Royal', group_id: 'grp-azul', nuance_id: 'nuc-escuro' },
  { id: 'var-azul-claro', slug: 'azul-claro', name: 'Azul Claro', group_id: 'grp-azul', nuance_id: 'nuc-claro' },
  { id: 'var-verde-folha', slug: 'verde-folha', name: 'Verde Folha', group_id: 'grp-verde', nuance_id: null },
];
const REF_NUANCES = [
  { id: 'nuc-escuro', slug: 'escuro', name: 'Escuro' },
  { id: 'nuc-claro', slug: 'claro', name: 'Claro' },
];

const EMPTY_OPTS = { colorGroups: [], colorVariations: [], colorNuances: [], colors: [] };

function setupRefMocks(variantRecords = [{ product_id: 'p1' }, { product_id: 'p2' }]) {
  mockDbInvoke.mockImplementation((opts: { table: string }) => {
    if (opts.table === 'color_groups')     return Promise.resolve({ records: REF_GROUPS });
    if (opts.table === 'color_variations') return Promise.resolve({ records: REF_VARIATIONS });
    if (opts.table === 'color_nuances')    return Promise.resolve({ records: REF_NUANCES });
    if (opts.table === 'product_variants') return Promise.resolve({ records: variantRecords });
    return Promise.resolve({ records: [] });
  });
}

beforeEach(() => vi.clearAllMocks());

// -- hasFilter ----------------------------------------------------------------
describe('hasFilter OR entre 4 grupos', () => {
  it('false quando todos arrays vazios', () => {
    const { result } = renderHook(() => useProductsByColor(EMPTY_OPTS));
    expect(result.current.hasFilter).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    [{ ...EMPTY_OPTS, colorGroups: ['azul'] }],
    [{ ...EMPTY_OPTS, colorVariations: ['azul-royal'] }],
    [{ ...EMPTY_OPTS, colorNuances: ['escuro'] }],
    [{ ...EMPTY_OPTS, colors: ['Azul'] }],
  ])('true quando qualquer grupo nao-vazio', (opts) => {
    const { result } = renderHook(() => useProductsByColor(opts));
    expect(result.current.hasFilter).toBe(true);
  });
});

// -- Sem filtro ---------------------------------------------------------------
describe('sem filtro ativo', () => {
  it('nao chama dbInvoke quando todos vazios', () => {
    renderHook(() => useProductsByColor(EMPTY_OPTS));
    expect(mockDbInvoke).not.toHaveBeenCalled();
  });

  it('productIds e Set vazio', () => {
    const { result } = renderHook(() => useProductsByColor(EMPTY_OPTS));
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- colorVariations ----------------------------------------------------------
describe('colorVariations lookup por slug', () => {
  it('adiciona variation ID correto ao targetColorIds', async () => {
    setupRefMocks();
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorVariations: ['azul-royal'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const variantCall = mockDbInvoke.mock.calls.find((c) => c[0].table === 'product_variants');
    expect(variantCall![0].filters.color_id).toContain('var-azul-royal');
  });

  it('retorna Set com product_ids', async () => {
    setupRefMocks();
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorVariations: ['azul-royal'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.has('p1')).toBe(true);
    expect(result.current.productIds.has('p2')).toBe(true);
  });
});

// -- colorGroups --------------------------------------------------------------
describe('colorGroups expande para todas variations do grupo', () => {
  it('inclui todas as variations do grupo', async () => {
    setupRefMocks();
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorGroups: ['azul'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const variantCall = mockDbInvoke.mock.calls.find((c) => c[0].table === 'product_variants');
    expect(variantCall![0].filters.color_id).toContain('var-azul-royal');
    expect(variantCall![0].filters.color_id).toContain('var-azul-claro');
  });
});

// -- colorNuances — BUG-SF-NUANCE --------------------------------------------
describe('colorNuances BUG-SF-NUANCE travado', () => {
  it('resolve slug escuro -> nuc-escuro -> var-azul-royal (via nuance_id)', async () => {
    setupRefMocks();
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorNuances: ['escuro'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const variantCall = mockDbInvoke.mock.calls.find((c) => c[0].table === 'product_variants');
    expect(variantCall).toBeDefined(); // ANTES: undefined (era ignorado)
    expect(variantCall![0].filters.color_id).toContain('var-azul-royal');
  });

  it('slug de nuance inexistente nao lanca e retorna Set vazio', async () => {
    setupRefMocks([]);
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorNuances: ['inexistente'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- targetColorIds vazio ----------------------------------------------------
describe('targetColorIds vazio apos resolucao', () => {
  it('nao consulta product_variants quando targetColorIds = 0', async () => {
    setupRefMocks();
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorVariations: ['cor-fantasma'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const variantCalls = mockDbInvoke.mock.calls.filter((c) => c[0].table === 'product_variants');
    expect(variantCalls.length).toBe(0);
    expect(result.current.productIds.size).toBe(0);
  });
});

// -- Erro --------------------------------------------------------------------
describe('tratamento de erro', () => {
  it('retorna Set vazio e loga erro quando dbInvoke rejeita', async () => {
    mockDbInvoke.mockRejectedValue(new Error('DB timeout'));
    const { logger } = await import('@/lib/logger');
    const { result } = renderHook(() =>
      useProductsByColor({ ...EMPTY_OPTS, colorVariations: ['azul-royal'] })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productIds.size).toBe(0);
    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });
});
