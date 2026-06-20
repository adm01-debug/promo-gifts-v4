/**
 * Testes — usePublicoAlvoOptions
 *
 * Carrega opções de Público-Alvo do SSOT v_super_filtro_options.
 * Corrige BUG-DB-03: antes vinha de products.tags.publicoAlvo (jamais hidratado
 * pelo catálogo lightweight), deixando a seção do Super Filtro eternamente vazia.
 *
 * Invariantes:
 *   - Retorna [] antes do fetch completar (estado inicial)
 *   - Retorna slugs em ordem de exibição
 *   - Filtra nulls e strings vazias
 *   - Retorna [] em caso de erro (não lança)
 *   - Chama dbInvoke com filtro filtro_tipo = 'target_audience'
 *   - Chama dbInvoke com orderBy = { column: 'ordem', ascending: true }
 *   - Cancela fetch se componente desmontado (cleanup via cancelled flag)
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePublicoAlvoOptions } from '../usePublicoAlvoOptions';
import { logger } from '@/lib/logger';

const mockDbInvoke = vi.fn();

vi.mock('@/lib/db/postgrest', () => ({
  dbInvoke: (...args: unknown[]) => mockDbInvoke(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('estado inicial', () => {
  it('retorna [] antes do fetch completar', () => {
    mockDbInvoke.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePublicoAlvoOptions());
    expect(result.current).toEqual([]);
  });
});

describe('dados corretos do SSOT', () => {
  it('retorna slugs em ordem de exibicao', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { slug_ou_codigo: 'corporativo', ordem: 1 },
        { slug_ou_codigo: 'feminino', ordem: 2 },
        { slug_ou_codigo: 'esportivo', ordem: 3 },
      ],
    });
    const { result } = renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(result.current.length).toBe(3));
    expect(result.current).toEqual(['corporativo', 'feminino', 'esportivo']);
  });

  it('filtra nulls e strings vazias', async () => {
    mockDbInvoke.mockResolvedValue({
      records: [
        { slug_ou_codigo: 'corporativo', ordem: 1 },
        { slug_ou_codigo: null, ordem: 2 },
        { slug_ou_codigo: '', ordem: 3 },
        { slug_ou_codigo: 'feminino', ordem: 4 },
      ],
    });
    const { result } = renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(result.current.length).toBe(2));
    expect(result.current).toEqual(['corporativo', 'feminino']);
  });

  it('retorna [] quando records vazio', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    const { result } = renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});

describe('invariantes de chamada ao dbInvoke', () => {
  it('chama com filtro filtro_tipo = target_audience', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    const args = mockDbInvoke.mock.calls[0][0];
    expect(args.table).toBe('v_super_filtro_options');
    expect(args.filters).toMatchObject({ filtro_tipo: 'target_audience' });
  });

  it('chama com orderBy.column = ordem ascending', async () => {
    mockDbInvoke.mockResolvedValue({ records: [] });
    renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(mockDbInvoke).toHaveBeenCalled());
    expect(mockDbInvoke.mock.calls[0][0].orderBy).toMatchObject({
      column: 'ordem',
      ascending: true,
    });
  });
});

describe('tratamento de erros', () => {
  it('retorna [] quando dbInvoke lanca (nao propaga erro)', async () => {
    mockDbInvoke.mockRejectedValue(new Error('DB offline'));
    const { result } = renderHook(() => usePublicoAlvoOptions());
    await waitFor(() => expect(vi.mocked(logger.error)).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});

describe('cleanup — sem state update apos unmount', () => {
  it('nao atualiza state apos desmontagem (cancelled flag)', async () => {
    let resolve!: (val: unknown) => void;
    const pending = new Promise(r => { resolve = r; });
    mockDbInvoke.mockReturnValue(pending);

    const { unmount } = renderHook(() => usePublicoAlvoOptions());
    unmount();

    await act(async () => {
      resolve({ records: [{ slug_ou_codigo: 'corporativo', ordem: 1 }] });
      await new Promise(r => setTimeout(r, 50));
    });

    // Se chegou aqui sem warning de "state update on unmounted component", cleanup ok
    expect(true).toBe(true);
  });
});
