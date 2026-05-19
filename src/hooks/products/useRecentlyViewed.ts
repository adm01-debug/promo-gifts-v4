import { useState, useEffect, useCallback, useRef } from "react";
import { type Product } from "@/hooks/products";

const STORAGE_KEY = "recently-viewed-products";
const MAX_ITEMS = 10;

export interface RecentlyViewedItem {
  productId: string;
  viewedAt: string;
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastAddedRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading recently viewed:", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToRecentlyViewed = useCallback((productId: string) => {
    if (lastAddedRef.current === productId) return;
    lastAddedRef.current = productId;

    setTimeout(() => {
      if (lastAddedRef.current === productId) {
        lastAddedRef.current = null;
      }
    }, 1000);

    setItems((prev) => {
      const filtered = prev.filter((item) => item.productId !== productId);
      return [{ productId, viewedAt: new Date().toISOString() }, ...filtered].slice(
        0,
        MAX_ITEMS
      );
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
    [items]
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
