import { useState, useMemo } from 'react';
import { useProducts, type Product } from '@/hooks/products';
import { useExternalTechniques } from '@/hooks/intelligence';
import { fetchPromobrindPriceTables } from '@/lib/external-db';
import { useQuery } from '@tanstack/react-query';
import {
  type SearchFilters,
  type ProductWithCalculatedPrice,
  type ViewMode,
  DEFAULT_FILTERS,
} from '@/pages/advanced-price-search/types';

export function useAdvancedPriceSearch() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [isSearching, setIsSearching] = useState(false);

  const { data: _products, isLoading: loadingProducts } = useProducts();
  const products = useMemo(() => (_products ?? []) as Product[], [_products]);
  const { data: techniques = [], isLoading: loadingTechniques } = useExternalTechniques();

  const { data: priceTables = [] } = useQuery({
    queryKey: ['price-tables-search', filters.technique, filters.minQuantity],
    queryFn: async () => {
      if (filters.technique === 'all') return [];
      return fetchPromobrindPriceTables({
        techniqueName: filters.technique,
        quantity: filters.minQuantity,
      });
    },
    enabled: filters.technique !== 'all',
  });

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
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
    products.forEach((p) => {
      p.colors?.forEach((c) => {
        if (c.hex && !colorMap.has(c.hex)) {
          colorMap.set(c.hex, { name: c.name, hex: c.hex });
        }
      });
    });
    return Array.from(colorMap.values());
  }, [products]);

  const filteredProducts = useMemo((): ProductWithCalculatedPrice[] => {
    if (!isSearching) return [];

    const result = products.filter((product) => {
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
        const hexes = product.colors?.map((c) => c.hex) || [];
        if (!filters.colors.some((c) => hexes.includes(c))) return false;
      }
      return true;
    });

    const withPrices: ProductWithCalculatedPrice[] = result.map((product) => {
      const productPrice = product.price || 0;
      let customizationPrice = 0,
        setupPrice = 0,
        handlingPrice = 0;
      let matchingTable = undefined as ProductWithCalculatedPrice['matchingTechnique'];

      if (filters.technique !== 'all' && priceTables.length > 0) {
        matchingTable =
          priceTables.find(
            (t) =>
              t.min_quantity <= filters.minQuantity &&
              (t.max_quantity === null || t.max_quantity >= filters.minQuantity),
          ) || priceTables[0];
        if (matchingTable) {
          customizationPrice = matchingTable.unit_price || 0;
          setupPrice = matchingTable.setup_price || 0;
          handlingPrice = matchingTable.handling_price || 0;
        }
      }

      const setupPerUnit = setupPrice / filters.minQuantity;
      const totalPerUnit =
        filters.priceType === 'with_personalization'
          ? productPrice + customizationPrice + setupPerUnit + handlingPrice
          : productPrice;

      return {
        ...product,
        calculatedUnitPrice: totalPerUnit,
        priceBreakdown: {
          productPrice,
          customizationPrice,
          setupPrice,
          handlingPrice,
          totalPerUnit,
        },
        matchingTechnique: matchingTable,
      };
    });

    return withPrices
      .filter(
        (p) =>
          p.priceBreakdown.totalPerUnit >= filters.priceRange[0] &&
          p.priceBreakdown.totalPerUnit <= filters.priceRange[1],
      )
      .sort((a, b) => a.priceBreakdown.totalPerUnit - b.priceBreakdown.totalPerUnit);
  }, [products, priceTables, filters, isSearching]);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setIsSearching(false);
  };

  const toggleColor = (hex: string) => {
    setFilters((prev) => ({
      ...prev,
      colors: prev.colors.includes(hex)
        ? prev.colors.filter((c) => c !== hex)
        : [...prev.colors, hex],
    }));
    setIsSearching(false);
  };

  return {
    filters,
    viewMode,
    setViewMode,
    isSearching,
    setIsSearching,
    filteredProducts,
    categories,
    availableColors,
    techniques,
    isLoading: loadingProducts || loadingTechniques,
    loadingTechniques,
    updateFilter,
    toggleColor,
    handleSearch: () => setIsSearching(true),
    handleReset: () => {
      setFilters(DEFAULT_FILTERS);
      setIsSearching(false);
    },
  };
}
