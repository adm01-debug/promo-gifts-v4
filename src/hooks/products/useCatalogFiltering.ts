/**
 * useCatalogFiltering — Filtering and sorting logic extracted from useCatalogState
 *
 * CHANGELOG:
 * - BUG-CF-01 FIXED: Filtros featured, isKit, publicoAlvo, datasComemorativas,
 *   endomarketing, ramosAtividade, segmentosAtividade agora são aplicados [T11]
 * - BUG-CF-02 FIXED: Supplier filter agora usa p.supplier?.name / p.supplier?.id
 *   ao invés de p.brand / p.supplier_reference [T12]
 * - BUG-CF-03 FIXED: inStock agora verifica estoque de variantes (p.colors) [T13]
 * - BUG-CS-04 FIXED: priceRange threshold unificado para PRICE_RANGE_MAX=9999 [T15]
 */
import { useMemo } from 'react';
import type { Product, SupplierSalesEntry } from '@/hooks/products';
import type { FilterState } from '@/components/filters/FilterPanel';
import type { SortOption } from '@/hooks/products/useCatalogState';
import { sortProducts } from '@/utils/product-sorting';

// BUG-CS-04 FIX: constante centralizada — sincronize com useCatalogState.ts e useAdvancedFilters.ts
export const PRICE_RANGE_MAX = 9999;

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
  // BUG-CF-01: memoize tag-based filter sets
  const publicoAlvoSet = useMemo(() => new Set(filters.publicoAlvo || []), [filters.publicoAlvo]);
  const datasComemSet = useMemo(
    () => new Set(filters.datasComemorativas || []),
    [filters.datasComemorativas],
  );
  const endomarketingSet = useMemo(
    () => new Set(filters.endomarketing || []),
    [filters.endomarketing],
  );
  const ramosAtivSet = useMemo(
    () => new Set(filters.ramosAtividade || []),
    [filters.ramosAtividade],
  );
  const segmentosAtivSet = useMemo(
    () => new Set(filters.segmentosAtividade || []),
    [filters.segmentosAtividade],
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

    // BUG-CF-02 FIX: usar p.supplier?.name e p.supplier?.id (não p.brand / p.supplier_reference)
    if (supplierFilterSet.size > 0) {
      result = result.filter(
        (p) =>
          supplierFilterSet.has(p.supplier?.name || '') ||
          supplierFilterSet.has(String(p.supplier?.id ?? '')),
      );
    }

    // BUG-CS-04 FIX: threshold mudado de 500 para PRICE_RANGE_MAX (9999)
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < PRICE_RANGE_MAX) {
      const [min, max] = filters.priceRange;
      result = result.filter((p) => p.price >= min && p.price <= max);
    }

    // BUG-CF-03 FIX: inStock agora verifica estoque de variantes (p.colors[].stock)
    if (filters.inStock) {
      result = result.filter(
        (p) =>
          (p.stock || 0) > 0 ||
          p.colors?.some((c: { stock?: number }) => (c.stock || 0) > 0),
      );
    }

    if (genderFilterSet.size > 0) {
      result = result.filter((p) => genderFilterSet.has((p.gender || '').toLowerCase().trim()));
    }

    // BUG-CF-01 FIX: featured filter agora aplicado
    if (filters.featured) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = result.filter((p) => (p as any).featured === true || (p as any).is_featured === true);
    }

    // BUG-CF-01 FIX: isKit filter agora aplicado
    if (filters.isKit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = result.filter((p) => (p as any).is_kit === true || (p as any).isKit === true);
    }

    // BUG-CF-01 FIX: publicoAlvo filter agora aplicado (target_audience ou publico_alvo)
    if (publicoAlvoSet.size > 0) {
      result = result.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pa = p as any;
        const arr: string[] = Array.isArray(pa.target_audience)
          ? pa.target_audience
          : Array.isArray(pa.publico_alvo)
            ? pa.publico_alvo
            : [];
        return arr.some((t) => publicoAlvoSet.has(t));
      });
    }

    // BUG-CF-01 FIX: datasComemorativas filter agora aplicado
    if (datasComemSet.size > 0) {
      result = result.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pa = p as any;
        const arr: string[] = Array.isArray(pa.commemorative_dates)
          ? pa.commemorative_dates
          : Array.isArray(pa.datas_comemorativas)
            ? pa.datas_comemorativas
            : [];
        return arr.some((d) => datasComemSet.has(d));
      });
    }

    // BUG-CF-01 FIX: endomarketing filter agora aplicado
    if (endomarketingSet.size > 0) {
      result = result.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pa = p as any;
        const arr: string[] = Array.isArray(pa.endomarketing) ? pa.endomarketing : [];
        return arr.some((e) => endomarketingSet.has(e));
      });
    }

    // BUG-CF-01 FIX: ramosAtividade filter agora aplicado
    if (ramosAtivSet.size > 0) {
      result = result.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pa = p as any;
        const arr: string[] = Array.isArray(pa.activity_sectors)
          ? pa.activity_sectors
          : Array.isArray(pa.ramos_atividade)
            ? pa.ramos_atividade
            : [];
        return arr.some((s) => ramosAtivSet.has(s));
      });
    }

    // BUG-CF-01 FIX: segmentosAtividade filter agora aplicado
    if (segmentosAtivSet.size > 0) {
      result = result.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pa = p as any;
        const arr: string[] = Array.isArray(pa.activity_segments)
          ? pa.activity_segments
          : Array.isArray(pa.segmentos_atividade)
            ? pa.segmentos_atividade
            : [];
        return arr.some((s) => segmentosAtivSet.has(s));
      });
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
    const skipSort =
      (hasFuzzySearch && sortBy === 'relevance') || (hasFuzzySearch && sortBy === 'name');
    // supplierSalesMap arrives typed as Map<string, number> via an upstream cast,
    // but its runtime entries are SupplierSalesEntry (from useSupplierSalesRanking).
    sortProducts(result, sortBy, {
      promoSalesMap,
      supplierSalesMap: supplierSalesMap as unknown as Map<string, SupplierSalesEntry> | undefined,
      skipSort,
    });

    return result;
  }, [
    filters.priceRange[0],
    filters.priceRange[1],
    filters.inStock,
    filters.materiais,
    filters.featured,
    filters.isKit,
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
    publicoAlvoSet,
    datasComemSet,
    endomarketingSet,
    ramosAtivSet,
    segmentosAtivSet,
  ]);
}
