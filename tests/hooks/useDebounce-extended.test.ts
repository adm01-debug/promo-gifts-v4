/**
 * Tests for useDebounce and useThrottle — extended scenarios
 * + BUG-24 regression: useSearchAsYouType onSearch stability
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useThrottle, useSearchAsYouType } from '@/hooks/common/useDebounce';

describe('useDebounce — extended', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update before delay', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 500),
      { initialProps: { v: 'a' } }
    );
    rerender({ v: 'b' });
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe('a');
  });

  it('updates exactly at delay', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 500),
      { initialProps: { v: 'a' } }
    );
    rerender({ v: 'b' });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('b');
  });

  it('resets on rapid changes, only last wins', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: 'a' } }
    );
    rerender({ v: 'b' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'c' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 'd' });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('d');
  });

  it('works with objects', () => {
    const obj1 = { x: 1 };
    const obj2 = { x: 2 };
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 200),
      { initialProps: { v: obj1 } }
    );
    rerender({ v: obj2 });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toEqual({ x: 2 });
  });

  it('works with null', () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 100),
      { initialProps: { v: 'x' as string | null } }
    );
    rerender({ v: null });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBeNull();
  });
});

describe('useThrottle — extended', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns initial value', () => {
    const { result } = renderHook(() => useThrottle(42, 300));
    expect(result.current).toBe(42);
  });

  it('works with string values', () => {
    const { result } = renderHook(() => useThrottle('hello'));
    expect(result.current).toBe('hello');
  });
});

/**
 * BUG-24 Regression Test — useSearchAsYouType
 *
 * Verifica que o useEffect NÃO re-executa quando apenas a referência de onSearch
 * muda (callback inline do pai), evitando buscas desnecessárias.
 */
describe('useSearchAsYouType — BUG-24: estabilidade de onSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('não re-executa onSearch quando só a referência muda sem mudança de query', () => {
    let callCount = 0;
    const onSearch1 = () => callCount++;
    const onSearch2 = () => callCount++;

    const { rerender } = renderHook(
      ({ onSearch }) => useSearchAsYouType(onSearch, { debounceMs: 0, minLength: 0 }),
      { initialProps: { onSearch: onSearch1 } },
    );

    // Avança o debounce para processar a query vazia inicial
    act(() => vi.advanceTimersByTime(0));
    const countAfterInit = callCount;

    // Troca a referência de onSearch sem mudar query nem minLength
    rerender({ onSearch: onSearch2 });

    // BUG-24: antes do fix, o useEffect re-executaria (onSearch estava nas deps)
    expect(callCount).toBe(countAfterInit);
  });

  it('usa sempre o onSearch mais recente ao disparar query', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ onSearch }) => useSearchAsYouType(onSearch, { debounceMs: 300, minLength: 2 }),
      { initialProps: { onSearch: onSearch1 } },
    );

    // Digita query antes de atualizar callback
    act(() => { result.current.setQuery('ab'); });

    // Atualiza callback ANTES do debounce disparar
    rerender({ onSearch: onSearch2 });

    // Dispara debounce
    act(() => vi.advanceTimersByTime(300));

    // Deve usar o callback mais recente (onSearch2), não o original
    expect(onSearch2).toHaveBeenCalledWith('ab');
    expect(onSearch1).not.toHaveBeenCalledWith('ab');
  });

  it('clear usa o callback mais recente', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ onSearch }) => useSearchAsYouType(onSearch, { debounceMs: 300 }),
      { initialProps: { onSearch: onSearch1 } },
    );

    // Avança timers para processar qualquer query inicial
    act(() => vi.advanceTimersByTime(300));
    onSearch1.mockClear();
    onSearch2.mockClear();

    // Troca callback e chama clear
    rerender({ onSearch: onSearch2 });
    act(() => { result.current.clear(); });

    // clear deve usar o callback mais recente (onSearch2)
    expect(onSearch2).toHaveBeenCalledWith('');
    // onSearch1 não deve ter sido chamado após o mockClear
    expect(onSearch1).not.toHaveBeenCalled();
  });
});
