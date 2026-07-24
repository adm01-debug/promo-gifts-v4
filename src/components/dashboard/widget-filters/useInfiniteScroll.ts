/**
 * useInfiniteScroll — hook simples baseado em IntersectionObserver para
 * disparar `onLoadMore` quando uma sentinela entra na viewport.
 *
 * Retorna um ref que deve ser anexado ao elemento sentinela no final da lista.
 */
import { useEffect, useRef } from 'react';

export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(
  onLoadMore: () => void,
  options: { enabled?: boolean; rootMargin?: string } = {},
) {
  const { enabled = true, rootMargin = '120px' } = options;
  const sentinelRef = useRef<T | null>(null);
  // Mantemos o callback estável dentro do efeito.
  const cbRef = useRef(onLoadMore);
  cbRef.current = onLoadMore;

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            cbRef.current();
          }
        }
      },
      { rootMargin, threshold: 0 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
