import { useState, useEffect, useCallback, useRef } from "react";
import { type Product } from "@/hooks/products";
import { useProductAnalytics } from "@/hooks/products";

const STORAGE_KEY = "product-comparison";
const MAX_COMPARE_ITEMS = 4;

interface UseComparisonOptions {
  onProductAdded?: () => void;
}

/**
 * Hook para gerenciar lista de comparação de produtos.
 * Armazena apenas IDs no localStorage; resolução para objetos Product é
 * feita via `getProductsByIds` do ProductsContext.
 */
export function useComparison(options?: UseComparisonOptions) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const onProductAddedRef = useRef(options?.onProductAdded);
  const { trackProductView } = useProductAnalytics();
  const trackProductViewRef = useRef(trackProductView);

  // Keep refs updated
  useEffect(() => {
    onProductAddedRef.current = options?.onProductAdded;
    trackProductViewRef.current = trackProductView;
  }, [options?.onProductAdded, trackProductView]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCompareIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading comparison:", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever compareIds change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
    }
  }, [compareIds, isLoaded]);

  const addToCompare = useCallback((productId: string): boolean => {
    let added = false;
    setCompareIds((prev) => {
      if (prev.includes(productId)) {
        return prev;
      }
      if (prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      added = true;
      onProductAddedRef.current?.();
      // Analytics (sem lookup – apenas ID)
      trackProductViewRef.current({
        productId,
        productSku: productId,
        productName: productId,
        viewType: "compare",
      });
      return [...prev, productId];
    });
    return added;
  }, []);

  const removeFromCompare = useCallback((productId: string) => {
    setCompareIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  const toggleCompare = useCallback(
    (productId: string): { added: boolean; isFull: boolean } => {
      let result = { added: false, isFull: false };

      setCompareIds((prev) => {
        if (prev.includes(productId)) {
          result = { added: false, isFull: false };
          return prev.filter((id) => id !== productId);
        }
        if (prev.length >= MAX_COMPARE_ITEMS) {
          result = { added: false, isFull: true };
          return prev;
        }
        result = { added: true, isFull: false };
        onProductAddedRef.current?.();
        trackProductViewRef.current({
          productId,
          productSku: productId,
          productName: productId,
          viewType: "compare",
        });
        return [...prev, productId];
      });

      return result;
    },
    []
  );

  const isInCompare = useCallback(
    (productId: string) => compareIds.includes(productId),
    [compareIds]
  );

  /**
   * Retorna produtos resolvidos a partir de um mapa externo (do ProductsContext).
   * Deve ser chamado pelo contexto/provider que tem acesso a `getProductsByIds`.
   */
  const getCompareProductsFromMap = useCallback(
    (getProductsByIds: (ids: string[]) => Product[]): Product[] =>
      getProductsByIds(compareIds),
    [compareIds]
  );

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  const canAddMore = compareIds.length < MAX_COMPARE_ITEMS;

  return {
    compareIds,
    compareCount: compareIds.length,
    maxItems: MAX_COMPARE_ITEMS,
    addToCompare,
    removeFromCompare,
    toggleCompare,
    isInCompare,
    /** @deprecated Use getProductsByIds from ProductsContext with compareIds from useComparisonStore instead */
    getCompareProductsFromMap,
    clearCompare,
    canAddMore,
    isLoaded,
  };
}
