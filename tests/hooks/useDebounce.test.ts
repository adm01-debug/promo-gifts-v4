import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/common/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } }
    );

    rerender({ value: 'b', delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: 'c', delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });
    
    rerender({ value: 'd', delay: 500 });
    act(() => { vi.advanceTimersByTime(200); });

    expect(result.current).toBe('a');

    act(() => { vi.advanceTimersByTime(500); });

    expect(result.current).toBe('d');
  });

  it('should work with different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 1000 } }
    );

    rerender({ value: 'new', delay: 1000 });

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('test');

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('new');
  });

  it('should work with numbers', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    rerender({ value: 42, delay: 300 });
    expect(result.current).toBe(0);

    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current).toBe(42);
  });

  it('should work with objects', () => {
    const initialObj = { name: 'test' };
    const newObj = { name: 'updated' };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initialObj, delay: 200 } }
    );

    rerender({ value: newObj, delay: 200 });
    expect(result.current).toBe(initialObj);

    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe(newObj);
  });

  it('should cleanup timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useDebounce('test', 500));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
