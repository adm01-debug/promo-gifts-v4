import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/products';
import { useExternalTechniques } from '@/hooks/intelligence';
import { fetchPromobrindPriceTables } from '@/lib/external-db';
import { useQuery } from '@tanstack/react-query';
<<<<<<< HEAD
import {
  type SearchFilters,
  type ProductWithCalculatedPrice,
  type ViewMode,
  DEFAULT_FILTERS,
} from './types';
=======
import { type SearchFilters, type ProductWithCalculatedPrice, type ViewMode, DEFAULT_FILTERS } from "@/pages/advanced-price-search/types";
import type { Product, ProductColor } from '@/types/product-catalog';
>>>>>>> origin/main

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
<<<<<<< HEAD
    products.forEach((p) => {
      const catName =
        typeof p.category === 'object' && p.category?.name
          ? p.category.name
          : typeof p.category === 'string'
            ? p.category
            : null;
=======
    products.forEach((p: Product) => {
      const catName = typeof p.category === 'object' && p.category?.name
        ? p.category.name
        : (typeof p.category === 'string' ? p.category : null);
>>>>>>> origin/main
      if (catName) cats.add(catName);
    });
    return Array.from(cats).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, { name: string; hex: string }>();
<<<<<<< HEAD
    products.forEach((p) => {
      p.colors?.forEach((c) => {
=======
    products.forEach((p: Product) => {
      p.colors?.forEach((c: ProductColor) => {
>>>>>>> origin/main
        if (c.hex && !colorMap.has(c.hex)) {
          colorMap.set(c.hex, { name: c.name, hex: c.hex });
        }
      });
    });
    return Array.from(colorMap.values());
  }, [products]);

  const filteredProducts = useMemo((): ProductWithCalculatedPrice[] => {
    if (!isSearching) return [];

<<<<<<< HEAD
    const result = products.filter((product) => {
=======
    const result = products.filter((product: Product) => {
>>>>>>> origin/main
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
<<<<<<< HEAD
        const hexes = product.colors?.map((c) => c.hex) || [];
        if (!filters.colors.some((c) => hexes.includes(c))) return false;
=======
        const hexes = product.colors?.map((c: ProductColor) => c.hex) || [];
        if (!filters.colors.some(c => hexes.includes(c))) return false;
>>>>>>> origin/main
      }
      return true;
    });

<<<<<<< HEAD
    const withPrices: ProductWithCalculatedPrice[] = result.map((product) => {
=======
    const withPrices: ProductWithCalculatedPrice[] = result.map((product: Product) => {
>>>>>>> origin/main
      const productPrice = product.price || 0;
      let customizationPrice = 0,
        setupPrice = 0,
        handlingPrice = 0;
      let matchingTable = undefined as ProductWithCalculatedPrice['matchingTechnique'];

      if (filters.technique !== 'all' && priceTables.length > 0) {
<<<<<<< HEAD
        matchingTable =
          priceTables.find(
            (t) =>
              t.min_quantity <= filters.minQuantity &&
              (t.max_quantity === null || t.max_quantity >= filters.minQuantity),
          ) || priceTables[0];
=======
        matchingTable = priceTables.find(t =>
          t.min_quantity <= filters.minQuantity &&
          (!t.max_quantity || t.max_quantity >= filters.minQuantity) &&
          t.technique_name.toLowerCase().includes(filters.technique.toLowerCase())
        );

>>>>>>> origin/main
        if (matchingTable) {
          customizationPrice = matchingTable.unit_price || 0;
          setupPrice = matchingTable.setup_price || 0;
          handlingPrice = matchingTable.handling_price || 0;
        }
      }

<<<<<<< HEAD
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
=======
      return {
        ...product,
        customizationPrice,
        setupPrice,
        handlingPrice,
        totalPrice: (productPrice + customizationPrice + handlingPrice) * filters.minQuantity + setupPrice,
>>>>>>> origin/main
        matchingTechnique: matchingTable,
      };
    });

<<<<<<< HEAD
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
=======
    return withPrices;
  }, [isSearching, products, filters, priceTables]);

  return {
    filters,
    setFilters,
>>>>>>> origin/main
    viewMode,
    setViewMode,
    isSearching,
    setIsSearching,
    filteredProducts,
    categories,
    availableColors,
    techniques,
<<<<<<< HEAD
    isLoading: loadingProducts || loadingTechniques,
    loadingTechniques,
    updateFilter,
    toggleColor,
    handleSearch: () => setIsSearching(true),
    handleReset: () => {
      setFilters(DEFAULT_FILTERS);
      setIsSearching(false);
    },
=======
    isLoading: loadingProducts || loadingTechniques || (filters.technique !== 'all' && loadingPriceTables),
>>>>>>> origin/main
  };
}
