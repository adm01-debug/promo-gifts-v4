/**
 * Testes — useAutoSaveQuote + migratePayload
 *
 * Hook de persistência automática de rascunhos no localStorage.
 * Cobre dois bugs históricos:
 *   BUG-07: onRestore capturado em ref para estabilizar deps do useEffect
 *   BUG-13: clearAutoSave memoizado com useCallback (referência estável)
 *
 * Invariantes testadas:
 *   migratePayload: v1→v2, payload futuro→null, null/não-objeto→null, v2 passthrough
 *   restore: chama onRestore com dados migrados no mount
 *   restore: só roda uma vez (hasRestoredRef guard)
 *   restore: enabled=false → não restaura
 *   save: debounced (não salva imediatamente)
 *   save: não salva quando dados não mudam
 *   save: cancela timer no cleanup (BUG-07)
 *   clearAutoSave: remove do localStorage
 *   clearAutoSave: referência estável entre re-renders (BUG-13)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoSaveQuote, migratePayload } from '../useAutoSaveQuote';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

// ── localStorage mock ─────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── migratePayload ────────────────────────────────────────────────────────────
describe('migratePayload', () => {
  it('migra payload v1 (sem campo version) para v2', () => {
    const v1 = { title: 'Orçamento', items: [] };
    const result = migratePayload(v1);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
    expect(result!.data).toEqual(v1);
    expect(result!.savedAt).toBeTruthy();
  });

  it('retorna payload v2 sem modificação (passthrough)', () => {
    const v2 = { version: 2, data: { title: 'Ok' }, savedAt: '2026-01-01T00:00:00.000Z' };
    const result = migratePayload(v2);
    expect(result).toEqual(v2);
  });

  it('retorna null para versão futura (previne corrupção)', () => {
    const future = { version: 99, data: {}, savedAt: '2099-01-01T00:00:00.000Z' };
    const result = migratePayload(future, 2);
    expect(result).toBeNull();
  });

  it('retorna null para null', () => {
    expect(migratePayload(null)).toBeNull();
  });

  it('retorna null para não-objeto', () => {
    expect(migratePayload('string')).toBeNull();
    expect(migratePayload(42)).toBeNull();
  });
});

// ── restore no mount ──────────────────────────────────────────────────────────
describe('restore ao montar', () => {
  it('chama onRestore com dados do localStorage quando enabled=true', () => {
    const savedData = { title: 'Rascunho', items: [1, 2] };
    const payload = { version: 2, data: savedData, savedAt: '2026-01-01T00:00:00.000Z' };
    store['quote_builder_autosave'] = JSON.stringify(payload);

    const onRestore = vi.fn();
    renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: {}, onRestore })
    );

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(savedData);
  });

  it('nao chama onRestore quando enabled=false', () => {
    store['quote_builder_autosave'] = JSON.stringify({ version: 2, data: { x: 1 }, savedAt: '' });
    const onRestore = vi.fn();

    renderHook(() =>
      useAutoSaveQuote({ enabled: false, data: {}, onRestore })
    );

    expect(onRestore).not.toHaveBeenCalled();
  });

  it('nao chama onRestore quando localStorage vazio', () => {
    const onRestore = vi.fn();
    renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: {}, onRestore })
    );
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('guard: restaura apenas uma vez mesmo após re-renders', () => {
    const savedData = { x: 1 };
    store['quote_builder_autosave'] = JSON.stringify({ version: 2, data: savedData, savedAt: '' });
    const onRestore = vi.fn();

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAutoSaveQuote({ enabled, data: {}, onRestore }),
      { initialProps: { enabled: true } }
    );
    rerender({ enabled: true });
    rerender({ enabled: true });

    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

// ── save debounced ────────────────────────────────────────────────────────────
describe('save com debounce', () => {
  it('nao salva imediatamente (debounce)', () => {
    renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: { x: 1 }, debounceMs: 2000 })
    );
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('salva apos debounceMs', () => {
    renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: { x: 1 }, debounceMs: 2000 })
    );
    act(() => { vi.advanceTimersByTime(2000); });
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('salva com schema version 2 no payload', () => {
    renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: { title: 'X' }, debounceMs: 500 })
    );
    act(() => { vi.advanceTimersByTime(500); });

    const [, savedJson] = localStorageMock.setItem.mock.calls[0];
    const payload = JSON.parse(savedJson);
    expect(payload.version).toBe(2);
    expect(payload.data).toEqual({ title: 'X' });
  });

  it('nao salva quando dados nao mudam', () => {
    const data = { x: 1 };
    // Simular que ja salvou antes
    const { rerender } = renderHook(() =>
      useAutoSaveQuote({ enabled: true, data, debounceMs: 500 })
    );
    act(() => { vi.advanceTimersByTime(500); });
    const firstCount = localStorageMock.setItem.mock.calls.length;

    // Re-render com mesmos dados
    rerender();
    act(() => { vi.advanceTimersByTime(500); });

    // Nao deve ter chamado de novo
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(firstCount);
  });

  it('cancela timer anterior ao desmontar (BUG-07 cleanup)', () => {
    const { unmount } = renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: { y: 2 }, debounceMs: 2000 })
    );
    unmount();
    act(() => { vi.advanceTimersByTime(2000); });

    // Timer foi cancelado: nao deve ter salvo
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('nao salva quando enabled=false', () => {
    renderHook(() =>
      useAutoSaveQuote({ enabled: false, data: { z: 3 }, debounceMs: 500 })
    );
    act(() => { vi.advanceTimersByTime(500); });
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ── clearAutoSave ─────────────────────────────────────────────────────────────
describe('clearAutoSave', () => {
  it('remove item do localStorage', () => {
    store['quote_builder_autosave'] = '{"version":2,"data":{},"savedAt":""}';
    const { result } = renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: {} })
    );

    act(() => { result.current.clearAutoSave(); });
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('quote_builder_autosave');
  });

  it('BUG-13: referencia estavel entre re-renders (useCallback)', () => {
    const { result, rerender } = renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: {} })
    );
    const ref1 = result.current.clearAutoSave;
    rerender();
    const ref2 = result.current.clearAutoSave;

    expect(ref1).toBe(ref2); // mesma referencia
  });

  it('usa a key correta ao remover', () => {
    const { result } = renderHook(() =>
      useAutoSaveQuote({ enabled: true, data: {}, key: 'minha_chave_custom' })
    );
    act(() => { result.current.clearAutoSave(); });
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('minha_chave_custom');
  });
});
