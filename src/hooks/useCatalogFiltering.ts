/**
 * useCatalogFiltering — Filtering and sorting logic extracted from useCatalogState
 */
import { useMemo } from "react";
import type { Product } from "@/hooks/useProducts";
import type { FilterState } from "@/components/filters/FilterPanel";
import type { SortOption } from "./useCatalogState";
import { sortProducts } from "@/utils/product-sorting";

interface CatalogFilteringOptions {
  realProducts: Product[];
  filters: FilterState;
  sortBy: SortOption;
  hasFuzzySearch: boolean;
  fuzzySearchResults: Product[];
  hasMaterialFilter: boolean;
  materialFilteredProductIds: Set<string>;
  isLoadingMaterialFilter: boolean;
  hasCategoryFilter: boolean;
  categoryFilteredProductIds: Set<string>;
  isLoadingCategoryFilter: boolean;
  promoSalesMap?: Map<string, number>;
  supplierSalesMap?: Map<string, number>;
}

export function useCatalogFiltering({
  realProducts, filters, sortBy, hasFuzzySearch, fuzzySearchResults,
  hasMaterialFilter, materialFilteredProductIds, isLoadingMaterialFilter,
  hasCategoryFilter, categoryFilteredProductIds, isLoadingCategoryFilter,
  promoSalesMap, supplierSalesMap,
}: CatalogFilteringOptions): Product[] {
  // Otimização: Memoizamos conjuntos de filtros para lookup O(1)
  const colorFilterSet = useMemo(() => new Set(filters.colors), [filters.colors]);
  const colorGroupSet = useMemo(() => new Set(filters.colorGroups), [filters.colorGroups]);
  const colorVariationSet = useMemo(() => new Set(filters.colorVariations), [filters.colorVariations]);
  const categoryFilterSet = useMemo(() => new Set(filters.categories.map(String)), [filters.categories]);
  const supplierFilterSet = useMemo(() => new Set(filters.suppliers), [filters.suppliers]);
  const genderFilterSet = useMemo(() => new Set(filters.gender?.map(g => g.toLowerCase().trim())), [filters.gender]);

  return useMemo(() => {
    if (realProducts.length === 0) return [];

    let result = hasFuzzySearch ? [...fuzzySearchResults] : [...realProducts];

    if (result.length === 0) return result;

    // Filter by Category IDs (pre-fetched or simple match)
    if (hasCategoryFilter && !isLoadingCategoryFilter) {
      if (categoryFilteredProductIds.size > 0) {
        result = result.filter((p) => categoryFilteredProductIds.has(p.id));
      } else {
        return [];
      }
    } else if (categoryFilterSet.size > 0) {
      result = result.filter((p) => categoryFilterSet.has(p.category_id || ''));
    }

    if (result.length === 0) return result;

    // Optimized Color Filtering: Process once per product
    const hasColorFilters = colorFilterSet.size > 0 || colorGroupSet.size > 0 || colorVariationSet.size > 0;
    if (hasColorFilters) {
      const groupArray = colorGroupSet.size > 0 ? Array.from(colorGroupSet).map(s => s.toLowerCase()) : null;
      
      result = result.filter((p) => {
        if (!p.colors?.length) return false;
        
        return p.colors.some((c: Record<string, string>) => {
          if (colorFilterSet.size > 0 && colorFilterSet.has(c.name)) return true;
          
          if (colorVariationSet.size > 0) {
            const vSlug = (c.variationSlug || '').toLowerCase().trim();
            if (colorVariationSet.has(vSlug)) return true;
          }
          
          if (groupArray) {
            const gSlug = (c.groupSlug || '').toLowerCase().trim();
            const gName = (c.group || '').toLowerCase().trim();
            const cName = (c.name || '').toLowerCase().trim();
            
            if (colorGroupSet.has(gSlug) || colorGroupSet.has(gName)) return true;
            if (groupArray.some(s => cName.includes(s))) return true;
          }
          
          return false;
        });
      });
    }

    if (result.length === 0) return result;

    if (supplierFilterSet.size > 0) {
      result = result.filter((p) =>
        supplierFilterSet.has(p.brand || '') ||
        supplierFilterSet.has(p.supplier_reference || '')
      );
    }

    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500) {
      const [min, max] = filters.priceRange;
      result = result.filter((p) => p.price >= min && p.price <= max);
    }

    if (filters.inStock) {
      result = result.filter((p) => (p.stock || 0) > 0);
    }

    if (genderFilterSet.size > 0) {
      result = result.filter((p) => genderFilterSet.has((p.gender || '').toLowerCase().trim()));
    }

    if (hasMaterialFilter && !isLoadingMaterialFilter) {
      if (materialFilteredProductIds.size > 0) {
        result = result.filter((p) => materialFilteredProductIds.has(p.id));
      } else {
        return [];
      }
    } else if (filters.materiais.length) {
      const lowerMateriais = filters.materiais.map(m => m.toLowerCase());
      result = result.filter((p) => {
        const mats = Array.isArray(p.materials) ? p.materials.join(' ').toLowerCase() : (p.materials || '').toLowerCase();
        return lowerMateriais.some((m) => mats.includes(m));
      });
    }

    // Business Logic - Do not change sorting behavior
    const skipSort = (hasFuzzySearch && sortBy === 'relevance') || (hasFuzzySearch && sortBy === 'name');
    sortProducts(result, sortBy, { promoSalesMap, supplierSalesMap, skipSort });

    return result;
  }, [
    filters.priceRange, filters.inStock, filters.materiais, // De-structure simple filter primitives
    sortBy, hasFuzzySearch, fuzzySearchResults, realProducts, 
    hasMaterialFilter, materialFilteredProductIds, isLoadingMaterialFilter, 
    hasCategoryFilter, categoryFilteredProductIds, isLoadingCategoryFilter, 
    promoSalesMap, supplierSalesMap, colorFilterSet, colorGroupSet, colorVariationSet, 
    categoryFilterSet, supplierFilterSet, genderFilterSet, hasColorFilters
  ]);
}
