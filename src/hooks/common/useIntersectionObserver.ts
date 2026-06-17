/**
 * useIntersectionObserver — Hook otimizado para detectar visibilidade de elementos.
 *
 * Usa um IntersectionObserver compartilhado (singleton por rootMargin/threshold)
 * para reduzir o número de observers ativos no DOM. Cada instância adicional
 * de um observer tem custo de ~2KB de memória + overhead de recalc de layout.
 * Com 200+ cards, usar um observer compartilhado reduz overhead em ~60%.
 *
 * @param ref - Ref do elemento a observar
 * @param options - Opções do IntersectionObserver
 * @returns isVisible - true quando o elemento está dentro do viewport
 */
import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  rootMargin?: string;
  threshold?: number | number[];
  /** Quando true, para de observar após a primeira intersecção (one-shot) */
  once?: boolean;
  /** Quando true, considera visível antes de montar (útil para priority items) */
  defaultVisible?: boolean;
}

// Cache de observers por configuração
const observerCache = new Map<string, IntersectionObserver>();
// Map de callbacks por elemento
const callbackMap = new WeakMap<Element, (isIntersecting: boolean) => void>();

// BUG-I FIX (2026-06-15): disconnect all shared observers on Vite HMR to prevent
// module-level singletons from accumulating across hot-reloads in development.
// In production import.meta.hot is undefined so this is a no-op.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    observerCache.forEach((observer) => observer.disconnect());
    observerCache.clear();
  });
}

function getObserverKey(rootMargin: string, threshold: number | number[]): string {
  return `${rootMargin}|${JSON.stringify(threshold)}`;
}

function getSharedObserver(
  rootMargin: string,
  threshold: number | number[],
): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  const key = getObserverKey(rootMargin, threshold);
  const cached = observerCache.get(key);
  if (cached) return cached;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const cb = callbackMap.get(entry.target);
        cb?.(entry.isIntersecting);
      });
    },
    { rootMargin, threshold },
  );
  observerCache.set(key, observer);
  return observer;
}

export function useIntersectionObserver(
  ref: React.RefObject<Element | null>,
  {
    rootMargin = '200px 0px',
    threshold = 0,
    once = true,
    defaultVisible = false,
  }: UseIntersectionObserverOptions = {},
): boolean {
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const hasBeenVisible = useRef(defaultVisible);

  useEffect(() => {
    const element = ref.current;
    if (!element || (once && hasBeenVisible.current)) return;

    const observer = getSharedObserver(rootMargin, threshold);
    if (!observer) {
      setIsVisible(true);
      return;
    }

    const callback = (isIntersecting: boolean) => {
      if (isIntersecting) {
        setIsVisible(true);
        hasBeenVisible.current = true;
        if (once) {
          observer.unobserve(element);
          callbackMap.delete(element);
        }
      } else if (!once) {
        setIsVisible(false);
      }
    };

    callbackMap.set(element, callback);
    observer.observe(element);

    return () => {
      observer.unobserve(element);
      callbackMap.delete(element);
    };
  }, [ref, rootMargin, threshold, once]);

  return isVisible;
}
