import { useState, useEffect, useCallback, useRef } from "react";
import { useProductAnalytics, type Product } from "@/hooks/products";

const STORAGE_KEY = "product-favorites";

export interface FavoriteItem {
  productId: string;
  addedAt: string;
}

interface UseFavoritesOptions {
  onFavoriteAdded?: () => void;
}

export function useFavorites(options?: UseFavoritesOptions) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const onFavoriteAddedRef = useRef(options?.onFavoriteAdded);
  const { trackProductView } = useProductAnalytics();
  const trackProductViewRef = useRef(trackProductView);

  useEffect(() => {
    onFavoriteAddedRef.current = options?.onFavoriteAdded;
    trackProductViewRef.current = trackProductView;
  }, [options?.onFavoriteAdded, trackProductView]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading favorites:", e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.productId === productId)) {
        return prev;
      }
      onFavoriteAddedRef.current?.();
      trackProductViewRef.current({
        productId,
        productSku: productId,
        productName: productId,
        viewType: "favorite",
      });
      return [...prev, { productId, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((productId: string) => {
    setFavorites((prev) => prev.filter((f) => f.productId !== productId));
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.productId === productId);
      if (exists) {
        return prev.filter((f) => f.productId !== productId);
      }
      onFavoriteAddedRef.current?.();
      trackProductViewRef.current({
        productId,
        productSku: productId,
        productName: productId,
        viewType: "favorite",
      });
      return [...prev, { productId, addedAt: new Date().toISOString() }];
    });
  }, []);

  const isFavorite = useCallback(
    (productId: string) => favorites.some((f) => f.productId === productId),
    [favorites]
  );

  const getFavoriteProductsFromMap = useCallback(
    (getProductsByIds: (ids: string[]) => Product[]): Product[] =>
      getProductsByIds(favorites.map((f) => f.productId)),
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    favoriteCount: favorites.length,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    getFavoriteProductsFromMap,
    clearFavorites,
    isLoaded,
  };
}
