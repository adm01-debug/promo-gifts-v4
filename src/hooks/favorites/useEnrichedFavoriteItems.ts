import { useMemo } from 'react';
import { useFavoriteListItems, type FavoriteListItem } from '@/hooks/favorites';
import { useProductsContext } from '@/contexts/ProductsContext';
import type { Product } from '@/types/product-catalog';

export interface EnrichedFavoriteItem {
  item: FavoriteListItem;
  product: Product | undefined;
  /** Diferença % entre preço atual e price_at_save. null se não houver snapshot. */
  priceDiffPct: number | null;
  /** Produto enriquecido com thumbnail da variante (se houver). */
  productWithVariant: Product | undefined;
}

/** Cruza favorite_items remotos + ProductsContext + price diff calculado. */
export function useEnrichedFavoriteItems(listId: string | null) {
  const { items, isLoading, addItem, updateItem, removeItem, moveItem, refetch } =
    useFavoriteListItems(listId);
  const { getProductsByIds, products: _signal } = useProductsContext();

  const enriched: EnrichedFavoriteItem[] = useMemo(() => {
    const ids = items.map((i) => i.product_id);
    const products = getProductsByIds(ids);
    const map = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => {
      const product = map.get(item.product_id);
      const variantInfo = item.variant_info;
      const productWithVariant =
        product && variantInfo?.thumbnail
          ? { ...product, images: [variantInfo.thumbnail, ...(product.images ?? [])] }
          : product;

      let priceDiffPct: number | null = null;
      if (product && item.price_at_save && item.price_at_save > 0) {
        const current = product.price ?? 0;
        if (current > 0) {
          priceDiffPct = ((current - item.price_at_save) / item.price_at_save) * 100;
        }
      }
      return { item, product, productWithVariant, priceDiffPct };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, getProductsByIds, _signal]);

  return {
    enriched,
    rawItems: items,
    isLoading,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    refetch,
  };
}
