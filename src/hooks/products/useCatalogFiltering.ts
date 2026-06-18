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
  // Filtro de cor server-side (opcional p/ retrocompat com call sites/tests legados;
  // o catálogo de produção sempre os fornece via useProductsByColor).
  hasColorFilter?: boolean;
  colorFilteredProductIds?: Set<string>;
  isLoadingColorFilter?: boolean;
  promoSalesMap?: Map<string, number>;
  supplierSalesMap?: Map<string, number>;
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

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
  hasColorFilter = false,
  colorFilteredProductIds = EMPTY_ID_SET as Set<string>,
  isLoadingColorFilter = false,
  promoSalesMap,
  supplierSalesMap,
}: CatalogFilteringOptions): Product[] {
  // Otimização: Memoizamos conjuntos de filtros para lookup O(1)
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

    // Color Filtering (server-side): os ids vêm de useProductsByColor (resolve
    // grupo/variação/cor → product_variants.color_id). Necessário porque os
    // produtos lightweight chegam com colors:[] (enriquecimento é posterior),
    // então inspecionar p.colors aqui zerava a grade. Padrão de categoria/material.
    if (hasColorFilter && !isLoadingColorFilter) {
      if (colorFilteredProductIds.size > 0) {
        result = result.filter((p) => colorFilteredProductIds.has(p.id));
      } else {
        return [];
      }
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
    // BUG-DEP FIX: hasCommercialPackaging era lido no corpo mas faltava nas deps
    // → alternar "Embalagem comercial" não re-filtrava até outra dep mudar.
    filters.hasCommercialPackaging,
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
    hasColorFilter,
    colorFilteredProductIds,
    isLoadingColorFilter,
    promoSalesMap,
    supplierSalesMap,
    categoryFilterSet,
    supplierFilterSet,
    genderFilterSet,
  ]);
}
