/**
 * useCatalogFiltering — Filtering and sorting logic extracted from useCatalogState
 */
import { useMemo } from 'react';
import type { Product, SupplierSalesEntry } from '@/hooks/products';
import type { ProductVariation } from '@/types/product-catalog';
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
  // FIX-21/22 parity: quando a RPC falha, productIds.size === 0 mas é erro de rede/timeout,
  // não "sem resultado real". O guard abaixo preserva a grade em vez de zerá-la.
  colorFilterError?: unknown;
  categoryFilterError?: unknown;
  materialFilterError?: unknown;
  hasMetadataFilter?: boolean;
  metadataFilteredProductIds?: Set<string>;
  isLoadingMetadataFilter?: boolean;
  metadataFilterError?: unknown;
  hasSizeFilter?: boolean;
  sizeFilteredProductIds?: Set<string>;
  isLoadingSizeFilter?: boolean;
  sizeFilterError?: unknown;
  promoSalesMap?: Map<string, number>;
  promoSales90dMap?: Map<string, number>;
  supplierSalesMap?: Map<string, SupplierSalesEntry>;
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
  colorFilterError = undefined,
  categoryFilterError = undefined,
  materialFilterError = undefined,
  hasMetadataFilter = false,
  metadataFilteredProductIds = EMPTY_ID_SET as Set<string>,
  isLoadingMetadataFilter = false,
  metadataFilterError = undefined,
  hasSizeFilter = false,
  sizeFilteredProductIds = EMPTY_ID_SET as Set<string>,
  isLoadingSizeFilter = false,
  sizeFilterError = undefined,
  promoSalesMap,
  promoSales90dMap,
  supplierSalesMap,
}: CatalogFilteringOptions): Product[] {
  // Otimização: Memoizamos conjuntos de filtros para lookup O(1)
  const categoryFilterSet = useMemo(
    () => new Set(filters.categories.map(String)),
    [filters.categories],
  );
  // FIX-17 parity: case-insensitive matching (applyProductFilters normalizes to lowercase).
  const supplierFilterSet = useMemo(
    () => new Set(filters.suppliers.map((s) => s.toLowerCase())),
    [filters.suppliers],
  );
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
      } else if (!categoryFilterError) {
        // FIX-21 parity: RPC error → preserve grid; genuine 0-matches → zero grid.
        return [];
      }
    } else if (categoryFilterSet.size > 0) {
      result = result.filter((p) => categoryFilterSet.has(p.category_id || ''));
    }

    // BUG-META-01 FIX: filtro de metadados server-side (público-alvo, datas, ramos, segmentos, tags)
    // via RPC fn_super_filtro_product_ids. Mesmo padrão do color/category filter.
    if (hasMetadataFilter && !isLoadingMetadataFilter) {
      if (metadataFilteredProductIds.size > 0) {
        result = result.filter((p) => metadataFilteredProductIds.has(p.id));
      } else if (!metadataFilterError) {
        return [];
      }
    }

    if (result.length === 0) return result;

    // Color Filtering (server-side): os ids vêm de useProductsByColor (resolve
    // grupo/variação/cor → product_variants.color_id). Necessário porque os
    // produtos lightweight chegam com colors:[] (enriquecimento é posterior),
    // então inspecionar p.colors aqui zerava a grade. Padrão de categoria/material.
    if (hasColorFilter && !isLoadingColorFilter) {
      if (colorFilteredProductIds.size > 0) {
        result = result.filter((p) => colorFilteredProductIds.has(p.id));
      } else if (!colorFilterError) {
        // FIX-21 parity: guard !colorFilterError mirrors applyProductFilters (FIX-21).
        return [];
      }
    }

    if (result.length === 0) return result;

    // BUG-SF-11 / FIX-17 parity: case-insensitive, plus partial name match on supplier.name
    // (applyProductFilters.ts FIX-17). Anterior: case-sensitive + só brand (sem supplier.name).
    if (supplierFilterSet.size > 0) {
      const supplierArr = [...supplierFilterSet].filter((s) => s !== '');
      result = result.filter((p) => {
        const suppId = (p.supplier?.id ?? '').toLowerCase();
        const suppRef = (p.supplier_reference ?? '').toLowerCase();
        const suppName = (p.supplier?.name || p.brand || '').toLowerCase();
        return (
          (suppId !== '' && supplierFilterSet.has(suppId)) ||
          (suppRef !== '' && supplierFilterSet.has(suppRef)) ||
          supplierArr.some((s) => suppName.includes(s))
        );
      });
    }

    // BUG-21 FIX: era < 500, deve ser < 9999 para ativar filtro no range completo [0, 9999].
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) {
      const [min, max] = filters.priceRange;
      // FIX-SF-F: 9999 é sentinela "sem limite" — não excluir produtos caros quando
      // só o mínimo é definido. max >= 9999 vira ilimitado.
      result = result.filter((p) => p.price >= min && (max >= 9999 || p.price <= max));
    }

    // FIX-INSTOCK-VARIATIONS: considera variações além do estoque agregado,
    // alinhando com applyProductFilters.ts (FIX-03) e com o bloco minStock abaixo.
    if (filters.inStock) {
      result = result.filter((p) => {
        if (p.variations && p.variations.length > 0)
          return p.variations.some((v: ProductVariation) => (v.stock ?? 0) > 0);
        return (p.stock || 0) > 0;
      });
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

    // FIX-16 parity: products without gender defined are neutral — included in any gender filter
    // (applyProductFilters.ts FIX-16). Anterior: gender=null zerava o produto do resultado.
    if (genderFilterSet.size > 0) {
      result = result.filter((p) => {
        const g = (p.gender ?? '').toLowerCase().trim();
        return g === '' || genderFilterSet.has(g);
      });
    }

    // BUG-CATALOG-SIZES FIX: tamanhos eram filtráveis no painel mas ignorados
    // no pipeline do catálogo principal. useProductsBySize consulta product_variants
    // server-side (mesmo padrão de cor/categoria/material).
    if (hasSizeFilter && !isLoadingSizeFilter) {
      if (sizeFilteredProductIds.size > 0) {
        result = result.filter((p) => sizeFilteredProductIds.has(p.id));
      } else if (!sizeFilterError) {
        return [];
      }
    }

    // BUG-VENDAS-FILTER-CATALOG FIX: minSupplierSales90d e minPromoSales90d eram
    // mostrados no painel e aplicados no Super Filtro (/filtros) mas ignorados aqui.
    // Usa supplierSalesMap.depleted90d (SupplierSalesEntry) e promoSales90dMap
    // — mesmas fontes que applyProductFilters.ts usa. Guarda: só filtra se o mapa
    // estiver disponível e não vazio (mapa ausente = dados ainda carregando → não filtra).
    if (filters.minSupplierSales90d > 0 && supplierSalesMap && supplierSalesMap.size > 0) {
      const threshold = filters.minSupplierSales90d;
      result = result.filter((p) => (supplierSalesMap.get(p.id)?.depleted90d ?? 0) >= threshold);
    }

    if (filters.minPromoSales90d > 0 && promoSales90dMap && promoSales90dMap.size > 0) {
      const threshold = filters.minPromoSales90d;
      result = result.filter((p) => (promoSales90dMap.get(p.id) ?? 0) >= threshold);
    }

    // BUG-MINSTOCK FIX: filtro de estoque mínimo era aplicado no Super Filtro (/filtros)
    // mas ignorado no catálogo principal (/produtos). Variações têm precedência sobre
    // estoque agregado do produto — some(v.stock >= threshold) OR product.stock >= threshold.
    if (filters.minStock > 0) {
      const threshold = filters.minStock;
      result = result.filter((p) => {
        if (p.variations && p.variations.length > 0)
          return p.variations.some((v: ProductVariation) => (v.stock ?? 0) >= threshold);
        return (p.stock || 0) >= threshold;
      });
    }

    // BUG-TECHNIQUES-FILTER FIX: técnicas eram filtráveis no painel mas ignoradas no
    // catálogo. Graceful degradation: se nenhum produto tem metadata.techniques preenchido
    // (catálogo leve não hidrata esse campo), o filtro é pulado para não zerar a grade.
    if (filters.techniques?.length) {
      const techSet = new Set(filters.techniques.map((t: string) => t.toLowerCase()));
      const techniquesDataAvailable = result.some(
        (p) => ((p.metadata?.techniques as string[] | undefined)?.length || 0) > 0,
      );
      if (techniquesDataAvailable) {
        result = result.filter((p) => {
          const metaTechs: string[] = (p.metadata?.techniques as string[]) ?? [];
          if (metaTechs.length > 0) {
            return metaTechs.some((t: string) => techSet.has(t.toLowerCase()));
          }
          return true;
        });
      }
    }

    if (hasMaterialFilter && !isLoadingMaterialFilter) {
      if (materialFilteredProductIds.size > 0) {
        result = result.filter((p) => materialFilteredProductIds.has(p.id));
      } else if (!materialFilterError) {
        // FIX-22 parity: guard !materialFilterError mirrors applyProductFilters (FIX-22).
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
    // supplierSalesMap entries são SupplierSalesEntry (from useSupplierSalesRanking).
    result = sortProducts(result, sortBy, {
      promoSalesMap,
      supplierSalesMap,
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
    colorFilterError,
    categoryFilterError,
    materialFilterError,
    hasMetadataFilter,
    metadataFilteredProductIds,
    isLoadingMetadataFilter,
    metadataFilterError,
    hasSizeFilter,
    sizeFilteredProductIds,
    isLoadingSizeFilter,
    sizeFilterError,
    promoSalesMap,
    promoSales90dMap,
    supplierSalesMap,
    filters.minSupplierSales90d,
    filters.minPromoSales90d,
    filters.minStock,
    filters.techniques,
    categoryFilterSet,
    supplierFilterSet,
    genderFilterSet,
  ]);
}
