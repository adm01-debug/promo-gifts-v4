/**
 * useCatalogFiltering — Filtering and sorting logic extracted from useCatalogState
 */
import { useMemo } from 'react';
import type { Product, SupplierSalesEntry } from '@/hooks/products';
import type { FilterState } from '@/components/filters/FilterPanel';
import type { SortOption } from '@/hooks/products/useCatalogState';
import { sortProducts } from '@/utils/product-sorting';
import { isProductKit } from '@/lib/products/kit-detection';

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
  realProducts,
  filters,
  sortBy,
  hasFuzzySearch,
  fuzzySearchResults,
  hasMaterialFilter,
  materialFilteredProductIds,
  isLoadingMaterialFilter,
  hasCategoryFilter,
  categoryFilteredProductIds,
  isLoadingCategoryFilter,
  promoSalesMap,
  supplierSalesMap,
}: CatalogFilteringOptions): Product[] {
  // Otimização: Memoizamos conjuntos de filtros para lookup O(1)
  const colorFilterSet = useMemo(() => new Set(filters.colors), [filters.colors]);
  const colorGroupSet = useMemo(() => new Set(filters.colorGroups), [filters.colorGroups]);
  const colorVariationSet = useMemo(
    () => new Set(filters.colorVariations),
    [filters.colorVariations],
  );
  const hasColorFilters =
    colorFilterSet.size > 0 || colorGroupSet.size > 0 || colorVariationSet.size > 0;
  const categoryFilterSet = useMemo(
    () => new Set(filters.categories.map(String)),
    [filters.categories],
  );
  const supplierFilterSet = useMemo(() => new Set(filters.suppliers), [filters.suppliers]);
  const genderFilterSet = useMemo(
    () => new Set(filters.gender?.map((g) => g.toLowerCase().trim())),
    [filters.gender],
  );

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
    if (hasColorFilters) {
      const groupArray =
        colorGroupSet.size > 0 ? Array.from(colorGroupSet).map((s) => s.toLowerCase()) : null;

      result = result.filter((p) => {
        if (!p.colors?.length) return false;

        // Use for...of for slightly better performance on large sets
        for (const c of p.colors) {
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
            // groupArray is small, so some is fine
            if (groupArray.some((s) => cName.includes(s))) return true;
          }
        }
        return false;
      });
    }

    if (result.length === 0) return result;

    // BUG-SF-11 FIX: implementação era inconsistente com useFiltersPageState.
    // useFiltersPageState usava supplier.id + supplier.name + supplier_reference.
    // Aqui, padronizamos para verificar supplier.id (mais confiável) além de brand e supplier_reference.
    if (supplierFilterSet.size > 0) {
      result = result.filter(
        (p) =>
          supplierFilterSet.has(p.supplier?.id || '') ||
          supplierFilterSet.has(p.brand || '') ||
          supplierFilterSet.has(p.supplier_reference || ''),
      );
    }

    // BUG-21 FIX: era < 500, deve ser < 9999 para ativar filtro no range completo [0, 9999].
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) {
      const [min, max] = filters.priceRange;
      // FIX-SF-F: 9999 é sentinela "sem limite" — não excluir produtos caros quando
      // só o mínimo é definido. max >= 9999 vira ilimitado.
      result = result.filter((p) => p.price >= min && (max >= 9999 || p.price <= max));
    }

    if (filters.inStock) {
      result = result.filter((p) => (p.stock || 0) > 0);
    }

    if (filters.hasCommercialPackaging) {
      result = result.filter((p) => p.hasCommercialPackaging === true);
    }

    if (filters.isKit) {
      result = result.filter((product) => isProductKit(product));
    }

    // SF-A parity: estes flags foram corrigidos no mapeamento leve mas estavam
    // ausentes do pipeline de filtragem do catálogo Index — Quick Options inertes
    // em /produtos (mesmo bug que SF-A corrigiu em /filtros via applyProductFilters).
    if (filters.featured) result = result.filter((p) => p.featured === true);
    if (filters.isNew) result = result.filter((p) => p.newArrival === true);
    if (filters.hasPersonalization) result = result.filter((p) => p.hasPersonalization === true);
    if (filters.onSale) result = result.filter((p) => p.onSale === true);

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
      const lowerMateriais = filters.materiais.map((m) => m.toLowerCase());
      result = result.filter((p) => {
        const mats = (
          Array.isArray(p.materials) ? p.materials.join(' ') : (p.materials ?? '')
        ).toLowerCase();
        return lowerMateriais.some((m) => mats.includes(m));
      });
    }

    // Business Logic - Do not change sorting behavior
    const skipSort = hasFuzzySearch && sortBy === 'name';
    // supplierSalesMap arrives typed as Map<string, number> via an upstream cast,
    // but its runtime entries are SupplierSalesEntry (from useSupplierSalesRanking).
    sortProducts(result, sortBy, {
      promoSalesMap,
      supplierSalesMap: supplierSalesMap as unknown as Map<string, SupplierSalesEntry> | undefined,
      skipSort,
    });

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filters.priceRange[0],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filters.priceRange[1],
    filters.inStock,
    filters.isKit,
    filters.featured,
    filters.isNew,
    filters.hasPersonalization,
    filters.onSale,
    filters.materiais,
    sortBy,
    hasFuzzySearch,
    fuzzySearchResults,
    realProducts,
    hasMaterialFilter,
    materialFilteredProductIds,
    isLoadingMaterialFilter,
    hasCategoryFilter,
    categoryFilteredProductIds,
    isLoadingCategoryFilter,
    promoSalesMap,
    supplierSalesMap,
    colorFilterSet,
    colorGroupSet,
    colorVariationSet,
    categoryFilterSet,
    supplierFilterSet,
    genderFilterSet,
    hasColorFilters,
  ]);
}
