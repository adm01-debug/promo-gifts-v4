/**
 * Tests for useDebounce and useThrottle — extended scenarios
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useThrottle } from '@/hooks/common/useDebounce';

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
