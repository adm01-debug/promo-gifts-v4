/**
 * useInfiniteScroll — observa um elemento sentinela e dispara loadMore quando entra na viewport.
 */
import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  threshold?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
  threshold = 0,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, rootMargin, threshold]);

  return { sentinelRef };
}
