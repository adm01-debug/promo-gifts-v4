/**
 * Testes — useIntersectionObserver
 *
 * Hook para detectar visibilidade de elementos via IntersectionObserver.
 * Usa cache singleton por rootMargin/threshold para eficiência.
 *
 * Invariantes:
 *   - retorna false inicialmente
 *   - registra observe() no mount quando ref.current existe
 *   - retorna true quando IntersectionObserver dispara
 *   - cleanup: chama unobserve ao desmontar
 *   - once=false: alterna de volta para false ao sair do viewport
 *   - sem IntersectionObserver (SSR): retorna false
 *
 * NOTA: o hook usa um IntersectionObserver COMPARTILHADO (cache singleton por
 * rootMargin/threshold). Entre testes, o cache persiste no módulo, então
 * rastreamos `sharedIO` separadamente de `instances` (que é resetado no
 * beforeEach) para não perder a referência ao observer cacheado.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { useIntersectionObserver } from '../useIntersectionObserver';

// Mock IntersectionObserver
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

// sharedIO tracks the last created IO even across beforeEach instance-array resets.
// This is necessary because the hook's module-level observerCache keeps the first
// created observer alive; subsequent tests reuse it (cache hit) without calling
// `new IntersectionObserver()` again. sharedIO lets tests call simulateIntersecting.
let sharedIO: MockIntersectionObserver | null = null;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IOCallback;

  constructor(cb: IOCallback) {
    this.callback = cb;
    MockIntersectionObserver.instances.push(this);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    sharedIO = this;
  }

  simulateIntersecting(target: Element, isIntersecting: boolean) {
    this.callback([{ isIntersecting, target } as IntersectionObserverEntry]);
  }
}

beforeEach(() => {
  // Reset only the instances array; sharedIO and the hook's observerCache persist
  // so that cache-hit paths are exercised correctly.
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIntersectionObserver', () => {
  it('retorna false inicialmente', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionObserver(ref);
    });
    // hook returns boolean directly (not { isVisible })
    expect(result.current).toBe(false);
  });

  it('chama observe no mount quando ref tem elemento', () => {
    const div = document.createElement('div');
    renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    // sharedIO is set (either freshly created or from the module cache)
    expect(sharedIO?.observe).toHaveBeenCalledWith(div);
  });

  it('retorna true quando IntersectionObserver dispara intersecao', () => {
    const div = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    act(() => {
      sharedIO?.simulateIntersecting(div, true);
    });
    expect(result.current).toBe(true);
  });

  it('retorna false quando IntersectionObserver sai do viewport (once=false)', () => {
    const div = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = { current: div };
      // once=false allows toggling visibility back to false
      return useIntersectionObserver(ref as never, { once: false });
    });
    act(() => {
      sharedIO?.simulateIntersecting(div, true);
    });
    act(() => {
      sharedIO?.simulateIntersecting(div, false);
    });
    expect(result.current).toBe(false);
  });

  it('cleanup: chama unobserve ao desmontar', () => {
    const div = document.createElement('div');
    const { unmount } = renderHook(() => {
      const ref = { current: div };
      return useIntersectionObserver(ref as never);
    });
    unmount();
    expect(sharedIO?.unobserve).toHaveBeenCalledWith(div);
  });

  it('nao registra observer quando ref.current=null', () => {
    // Reset sharedIO to confirm no new instance is created
    sharedIO = null;
    const { result } = renderHook(() => {
      const ref = { current: null };
      return useIntersectionObserver(ref as never);
    });
    // ref.current=null → effect returns early → no new IntersectionObserver created
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(sharedIO).toBeNull();
    expect(result.current).toBe(false);
  });
});
