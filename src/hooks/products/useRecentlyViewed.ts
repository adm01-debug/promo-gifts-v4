import { useState, useEffect, useCallback, useRef } from 'react';
import { type Product } from '@/hooks/products';

import { logger } from '@/lib/logger';
const STORAGE_KEY = 'recently-viewed-products';
const MAX_ITEMS = 10;

export interface RecentlyViewedItem {
  productId: string;
  viewedAt: string;
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastAddedRef = useRef<string | null>(null);
  // BUG-15 FIX: store the dedupe timeout id so it can be cleared on unmount
  // and when addToRecentlyViewed is called again before the previous 1s window
  // has elapsed. Previously setTimeout was called without storing the id,
  // leaving a pending callback that would fire after unmount.
  const dedupeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed as RecentlyViewedItem[]);
        }
      }
    } catch (e) {
      logger.error('Error loading recently viewed:', e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isLoaded]);

  // Cleanup the dedupe timer on unmount
  useEffect(() => {
    return () => {
      if (dedupeTimerRef.current) clearTimeout(dedupeTimerRef.current);
    };
  }, []);

  const addToRecentlyViewed = useCallback((productId: string) => {
    if (lastAddedRef.current === productId) return;
    lastAddedRef.current = productId;

    // Clear any previous pending timer before setting a new one
    if (dedupeTimerRef.current) clearTimeout(dedupeTimerRef.current);
    dedupeTimerRef.current = setTimeout(() => {
      dedupeTimerRef.current = undefined;
      if (lastAddedRef.current === productId) {
        lastAddedRef.current = null;
      }
    }, 1000);

    setItems((prev) => {
      const filtered = prev.filter((item) => item.productId !== productId);
      return [{ productId, viewedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_ITEMS);
    });
  }, []);

  const removeFromRecentlyViewed = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setItems([]);
  }, []);

  const getRecentlyViewedProductsFromMap = useCallback(
    (getProductsByIds: (ids: string[]) => Product[]): Product[] =>
      getProductsByIds(items.map((i) => i.productId)),
    [items],
  );

  return {
    items,
    itemCount: items.length,
    addToRecentlyViewed,
    removeFromRecentlyViewed,
    clearRecentlyViewed,
    getRecentlyViewedProductsFromMap,
    isLoaded,
  };
}
