import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/products';
import { useExternalTechniques } from '@/hooks/intelligence';
import { fetchPromobrindPriceTables } from '@/lib/external-db';
import { useQuery } from '@tanstack/react-query';
import {
  type SearchFilters,
  type ProductWithCalculatedPrice,
  type ViewMode,
  DEFAULT_FILTERS,
} from '@/pages/advanced-price-search/types';
import type { Product, ProductColor } from '@/types/product-catalog';

export function useAdvancedPriceSearch() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isSearching, setIsSearching] = useState(false);

  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: techniques = [], isLoading: loadingTechniques } = useExternalTechniques();

  const { data: priceTables = [], isLoading: loadingPriceTables } = useQuery({
    queryKey: ['price-tables', filters.technique],
    queryFn: () => {
      return fetchPromobrindPriceTables({
        techniqueName: filters.technique,
        quantity: filters.minQuantity,
      });
    },
    enabled: filters.technique !== 'all',
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p: Product) => {
      const catName =
        typeof p.category === 'object' && p.category?.name
          ? p.category.name
          : typeof p.category === 'string'
            ? p.category
            : null;
      if (catName) cats.add(catName);
    });
    return Array.from(cats).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, { name: string; hex: string }>();
    products.forEach((p: Product) => {
      p.colors?.forEach((c: ProductColor) => {
        if (c.hex && !colorMap.has(c.hex)) {
          colorMap.set(c.hex, { name: c.name, hex: c.hex });
        }
      });
    });
    return Array.from(colorMap.values());
  }, [products]);

  const filteredProducts = useMemo((): ProductWithCalculatedPrice[] => {
    if (!isSearching) return [];

    const result = products.filter((product: Product) => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (
          !product.name.toLowerCase().includes(query) &&
          !product.sku?.toLowerCase().includes(query)
        )
          return false;
      }
      if (filters.category !== 'all') {
        const cat =
          typeof product.category === 'object' && product.category?.name
            ? product.category.name
            : typeof product.category === 'string'
              ? product.category
              : null;
        if (cat !== filters.category) return false;
      }
      if (filters.colors.length > 0) {
        const hexes = product.colors?.map((c: ProductColor) => c.hex) ?? [];
        if (!filters.colors.some((c) => hexes.includes(c))) return false;
      }
      return true;
    });

    const withPrices: ProductWithCalculatedPrice[] = result.map((product: Product) => {
      const productPrice = product.price || 0;
      let customizationPrice = 0,
        setupPrice = 0,
        handlingPrice = 0;
      let matchingTable = undefined as ProductWithCalculatedPrice['matchingTechnique'];

      if (filters.technique !== 'all' && priceTables.length > 0) {
        matchingTable = priceTables.find(
          (t) =>
            t.min_quantity <= filters.minQuantity &&
            (!t.max_quantity || t.max_quantity >= filters.minQuantity) &&
            (t.technique_name ?? '').toLowerCase().includes(filters.technique.toLowerCase()),
        );

        if (matchingTable) {
          customizationPrice = matchingTable.unit_price ?? 0;
          setupPrice = matchingTable.setup_price || 0;
          handlingPrice = matchingTable.handling_price || 0;
        }
      }

      const calculatedUnitPrice = productPrice + customizationPrice + handlingPrice;

      return {
        ...product,
        calculatedUnitPrice,
        priceBreakdown: {
          productPrice,
          customizationPrice,
          setupPrice,
          handlingPrice,
          totalPerUnit: calculatedUnitPrice,
        },
        customizationPrice,
        setupPrice,
        handlingPrice,
        totalPrice:
          (productPrice + customizationPrice + handlingPrice) * filters.minQuantity + setupPrice,
        matchingTechnique: matchingTable,
      };
    });

    return withPrices;
  }, [isSearching, products, filters, priceTables]);

  return {
    filters,
    setFilters,
    viewMode,
    setViewMode,
    isSearching,
    setIsSearching,
    filteredProducts,
    categories,
    availableColors,
    techniques,
    isLoading:
      loadingProducts || loadingTechniques || (filters.technique !== 'all' && loadingPriceTables),
  };
}
