import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScroll, useScrollDirection, useIsScrolled, useScrollProgress } from '@/hooks/ui/useScroll';

describe('useScroll', () => {
  it('starts at top', () => {
    const { result } = renderHook(() => useScroll());
    expect(result.current.isAtTop).toBe(true);
    expect(result.current.isScrolled).toBe(false);
    expect(result.current.scrollY).toBe(0);
  });

  it('accepts custom threshold', () => {
    const { result } = renderHook(() => useScroll({ threshold: 50 }));
    expect(result.current.isAtTop).toBe(true);
  });
});

describe('useScrollDirection', () => {
  it('starts as null', () => {
    const { result } = renderHook(() => useScrollDirection());
    expect(result.current).toBeNull();
  });
});

describe('useIsScrolled', () => {
  it('starts as false', () => {
    const { result } = renderHook(() => useIsScrolled());
    expect(result.current).toBe(false);
  });

  it('accepts custom threshold', () => {
    const { result } = renderHook(() => useIsScrolled(50));
    expect(result.current).toBe(false);
  });
});

describe('useScrollProgress', () => {
  it('starts at 0', () => {
    const { result } = renderHook(() => useScrollProgress());
    expect(result.current).toBe(0);
  });
});
