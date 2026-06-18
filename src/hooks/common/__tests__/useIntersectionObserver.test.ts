/**
 * Testes — useIntersectionObserver
 *
 * Hook para detectar visibilidade de elementos via IntersectionObserver.
 * Usa cache singleton por rootMargin/threshold para eficiência.
 *
 * Invariantes:
 *   - retorna isVisible=false inicialmente
 *   - registra observe() no mount quando ref.current existe
 *   - retorna isVisible=true quando IntersectionObserver dispara
 *   - cleanup: chama unobserve ao desmontar
 *   - triggerOnce: para de observar após primeira interseção
 *   - sem IntersectionObserver (SSR): retorna null, isVisible=false
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { useIntersectionObserver } from '../useIntersectionObserver';

// Mock IntersectionObserver
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IOCallback;

  constructor(cb: IOCallback) {
    this.callback = cb;
    MockIntersectionObserver.instances.push(this);
  }

  // Helper para simular entry
  simulateIntersecting(target: Element, isIntersecting: boolean) {
    this.callback([{ isIntersecting, target } as IntersectionObserverEntry]);
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIntersectionObserver', () => {
  it('isVisible=false inicialmente', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionObserver(ref);
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('chama observe no mount quando ref tem elemento', () => {
    const div = document.createElement('div');
    const { result: _result } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    const io = MockIntersectionObserver.instances[0];
    expect(io?.observe).toHaveBeenCalledWith(div);
  });

  it('isVisible=true quando IntersectionObserver dispara intersecao', () => {
    const div = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    const io = MockIntersectionObserver.instances[0];
    act(() => { io?.simulateIntersecting(div, true); });
    expect(result.current.isVisible).toBe(true);
  });

  it('isVisible=false quando IntersectionObserver dispara sem intersecao', () => {
    const div = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    const io = MockIntersectionObserver.instances[0];
    act(() => { io?.simulateIntersecting(div, true); });
    act(() => { io?.simulateIntersecting(div, false); });
    expect(result.current.isVisible).toBe(false);
  });

  it('cleanup: chama unobserve ao desmontar', () => {
    const div = document.createElement('div');
    const { unmount } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    const io = MockIntersectionObserver.instances[0];
    unmount();
    expect(io?.unobserve).toHaveBeenCalledWith(div);
  });

  it('nao registra observer quando ref.current=null', () => {
    const { result } = renderHook(() => {
      const ref = { current: null };
      return useIntersectionObserver(ref as never);
    });
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(result.current.isVisible).toBe(false);
  });
});
