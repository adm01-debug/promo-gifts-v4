/**
 * Testes do singleton `useRuptureHorizon`.
 * Cobre: valor inicial, persistência em localStorage, sincronização entre
 * múltiplos consumidores, sanitização de valores inválidos e tolerância a
 * storage indisponível.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RUPTURE_HORIZON } from '@/lib/inventory/rupture-risk';

const STORAGE_KEY = 'stock.ruptureHorizon';

async function freshImport() {
  vi.resetModules();
  return await import('../useRuptureHorizon');
}

describe('useRuptureHorizon', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna o default quando localStorage está vazio', async () => {
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    expect(result.current[0]).toBe(DEFAULT_RUPTURE_HORIZON);
  });

  it('lê valor previamente persistido', async () => {
    window.localStorage.setItem(STORAGE_KEY, '15');
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    expect(result.current[0]).toBe(15);
  });

  it('descarta valor inválido (fora das opções) e cai no default', async () => {
    window.localStorage.setItem(STORAGE_KEY, '999');
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    expect(result.current[0]).toBe(DEFAULT_RUPTURE_HORIZON);
  });

  it('descarta valor não-numérico', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'abc');
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    expect(result.current[0]).toBe(DEFAULT_RUPTURE_HORIZON);
  });

  it('setter persiste no localStorage', async () => {
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    act(() => result.current[1](30));
    expect(result.current[0]).toBe(30);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('30');
  });

  it('propaga mudanças entre múltiplos consumidores (singleton)', async () => {
    const { useRuptureHorizon } = await freshImport();
    const a = renderHook(() => useRuptureHorizon());
    const b = renderHook(() => useRuptureHorizon());
    act(() => a.result.current[1](7));
    expect(a.result.current[0]).toBe(7);
    expect(b.result.current[0]).toBe(7);
    act(() => b.result.current[1](15));
    expect(a.result.current[0]).toBe(15);
    expect(b.result.current[0]).toBe(15);
  });

  it('não quebra quando localStorage.setItem lança (storage cheio)', async () => {
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => act(() => result.current[1](30))).not.toThrow();
    expect(result.current[0]).toBe(30); // memória ainda atualiza
    spy.mockRestore();
  });

  it('cobre todas as opções válidas (3, 7, 15, 30)', async () => {
    const { useRuptureHorizon } = await freshImport();
    const { result } = renderHook(() => useRuptureHorizon());
    for (const d of [3, 7, 15, 30] as const) {
      act(() => result.current[1](d));
      expect(result.current[0]).toBe(d);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(d));
    }
  });
});
