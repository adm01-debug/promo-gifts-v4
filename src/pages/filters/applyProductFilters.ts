/**
 * applyProductFilters — pipeline puro de filtragem + ordenação do Super Filtro.
 *
 * Extraído de useFiltersPageState para permitir simulação exaustiva de cenários
 * em testes unitários (sem React/hooks). O hook computa os Sets/maps server-side
 * e o contexto, e delega toda a lógica de filtro a esta função pura.
 *
 * INVARIANTE: o comportamento deve ser idêntico ao do useMemo original. Qualquer
 * mudança de semântica precisa de teste correspondente em
 * applyProductFilters.simulation.test.ts.
 */
import type { Product, SupplierSalesEntry } from '@/hooks/products';
import type { FilterState } from '@/components/filters/FilterPanel';
import type { ProductVariation } from '@/types/product-catalog';
import { sortProducts } from '@/utils/product-sorting';
import { isProductKit } from '@/lib/products/kit-detection';

export interface ProductFilterContext {
  hasFuzzySearch: boolean;
  fuzzySearchResults: Product[];
  techniquesDataAvailable: boolean;
  hasColorFilter: boolean;
  colorFilteredProductIds: Set<string>;
  isLoadingColorFilter: boolean;
  hasCategoryFilter: boolean;
  categoryFilteredProductIds: Set<string>;
  isLoadingCategoryFilter: boolean;
  categoryFilterError: unknown;
  hasMaterialFilter: boolean;
  materialFilteredProductIds: Set<string>;
  isLoadingMaterialFilter: boolean;
  /**
   * SF-E (sizes server-side). Quando `hasSizeFilter` é true, a filtragem por
   * tamanho usa o Set de product IDs vindo de product_variants (em vez da
   * verificação client-side por `product.variations`, ausente no catálogo leve).
   * Opcional para retrocompatibilidade: sem ele, cai no comportamento legado.
   */
  hasSizeFilter?: boolean;
  sizeFilteredProductIds?: Set<string>;
  isLoadingSizeFilter?: boolean;
  sizeFilterError?: unknown;
  /**
   * BUG-DB-02 (metadados server-side): datas/tags/ramos/segmentos/público vivem em
   * tabelas relacionais e NÃO são hidratados no catálogo leve. Quando o Set vem da
   * RPC fn_super_filtro_product_ids, ele substitui os blocos client-side legados
   * (product.tags.* é vazio no leve → zeravam a grade). Opcional p/ retrocompat.
   */
  hasMetadataFilter?: boolean;
  metadataFilteredProductIds?: Set<string>;
  isLoadingMetadataFilter?: boolean;
  metadataFilterError?: unknown;
  promoSalesMap?: Map<string, number>;
  supplierSalesMap?: Map<string, SupplierSalesEntry>;
  promoSales90dMap?: Map<string, number>;
}

export function applyProductFilters(
  realProducts: Product[],
  filters: FilterState,
  sortBy: string,
  ctx: ProductFilterContext,
): Product[] {
  const {
    hasFuzzySearch,
    fuzzySearchResults,
    techniquesDataAvailable,
    hasColorFilter,
    colorFilteredProductIds,
    isLoadingColorFilter,
    hasCategoryFilter,
    categoryFilteredProductIds,
    isLoadingCategoryFilter,
    categoryFilterError,
    hasMaterialFilter,
    materialFilteredProductIds,
    isLoadingMaterialFilter,
    hasSizeFilter,
    sizeFilteredProductIds,
    isLoadingSizeFilter,
    sizeFilterError,
    hasMetadataFilter,
    metadataFilteredProductIds,
    isLoadingMetadataFilter,
    metadataFilterError,
    promoSalesMap,
    supplierSalesMap,
    promoSales90dMap,
  } = ctx;

  let result = hasFuzzySearch ? [...fuzzySearchResults] : [...realProducts];

  // FIX-01: filtro de busca substring só aplica quando NÃO há fuzzy search ativo.
  if (filters.search && !hasFuzzySearch) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.sku && p.sku.toLowerCase().includes(s)) ||
        (p.description && p.description.toLowerCase().includes(s)),
    );
  }
  if (hasColorFilter && colorFilteredProductIds.size > 0)
    result = result.filter((p) => colorFilteredProductIds.has(p.id));
  else if (hasColorFilter && colorFilteredProductIds.size === 0 && !isLoadingColorFilter)
    result = [];
  if (hasCategoryFilter && categoryFilteredProductIds.size > 0)
    result = result.filter((p) => categoryFilteredProductIds.has(p.id));
  else if (
    hasCategoryFilter &&
    categoryFilteredProductIds.size === 0 &&
    !isLoadingCategoryFilter &&
    !categoryFilterError
  )
    result = [];
  if (filters.suppliers.length > 0) {
    const supplierIdSet = new Set(filters.suppliers);
    const supplierLowerArr = filters.suppliers.map((s) => s.toLowerCase());
    result = result.filter((product) => {
      if (supplierIdSet.has(product.supplier?.id ?? '')) return true;
      if (supplierIdSet.has(product.supplier_reference || '')) return true;
      const sName = (product.supplier?.name || product.brand || '').toLowerCase();
      return supplierLowerArr.some((s) => sName.includes(s));
    });
  }
  // BUG-DB-02: metadados server-side (datas/tags/ramos/segmentos/público) via RPC.
  // Quando o Set é fornecido, substitui os 4 blocos client-side legados abaixo
  // (operam sobre product.tags.*, vazio no catálogo leve → zeravam a grade).
  if (hasMetadataFilter && metadataFilteredProductIds) {
    if (metadataFilteredProductIds.size > 0) {
      result = result.filter((p) => metadataFilteredProductIds.has(p.id));
    } else if (!isLoadingMetadataFilter && !metadataFilterError) {
      result = [];
    }
    // Se metadataFilterError: RPC falhou — preserva a grade (erro visível via toast no hook consumer)
  }
  if (!hasMetadataFilter && filters.publicoAlvo.length > 0) {
    const pSet = new Set(filters.publicoAlvo.map((p) => p.toLowerCase()));
    result = result.filter((product) =>
      (product.tags?.publicoAlvo ?? []).some((t: string) => pSet.has(t.toLowerCase())),
    );
  }
  if (!hasMetadataFilter && filters.datasComemorativas.length > 0) {
    const dcLower = filters.datasComemorativas.map((d) => d.toLowerCase());
    result = result.filter((product) =>
      (product.tags?.datasComemorativas ?? []).some((t: string) => {
        const tl = t.toLowerCase();
        return dcLower.some((d) => tl.includes(d));
      }),
    );
  }
  // BUG-DB-07 FIX (2026-06-18): gate !hasMetadataFilter, consistente com publicoAlvo,
  // datasComemorativas e ramosAtividade. Sem o gate, um URL ?endomarketing=X com
  // hasMetadataFilter=true zeraria a grade (tags.endomarketing vazio no catálogo leve).
  // Quando metadata filter está ativo, a RPC fn_super_filtro_product_ids cobre
  // todos os metadados; o bloco client-side é corretamente ignorado.
  if (!hasMetadataFilter && filters.endomarketing.length > 0) {
    const eSet = new Set(filters.endomarketing.map((e) => e.toLowerCase()));
    result = result.filter((product) =>
      (product.tags?.endomarketing ?? []).some((t: string) => eSet.has(t.toLowerCase())),
    );
  }
  if (
    !hasMetadataFilter &&
    (filters.ramosAtividade?.length > 0 || filters.segmentosAtividade?.length > 0)
  ) {
    const ramosLower = filters.ramosAtividade?.map((r) => r.toLowerCase()) ?? [];
    const segLower = filters.segmentosAtividade?.map((s) => s.toLowerCase()) ?? [];
    result = result.filter((product) => {
      const ramos = product.tags?.ramo ?? [];
      const nichos = product.tags?.nicho ?? [];
      // BUG-SF-06 FIX: AND logic — product must match ramo AND segmento when both active.
      const matchesRamo = ramosLower.length
        ? ramosLower.some((r) => ramos.some((t: string) => t.toLowerCase().includes(r)))
        : true;
      const matchesSegmento = segLower.length
        ? segLower.some((s) => nichos.some((t: string) => t.toLowerCase().includes(s)))
        : true;
      return matchesRamo && matchesSegmento;
    });
  }
  if (hasMaterialFilter && materialFilteredProductIds.size > 0)
    result = result.filter((p) => materialFilteredProductIds.has(p.id));
  else if (hasMaterialFilter && materialFilteredProductIds.size === 0 && !isLoadingMaterialFilter)
    result = [];
  if (!hasMaterialFilter && filters.materiais.length > 0) {
    const materiaisLower = filters.materiais.map((m) => m.toLowerCase());
    result = result.filter((product) => {
      const materialsStr = product.materials.join(' ').toLowerCase();
      return materiaisLower.some((m) => materialsStr.includes(m));
    });
  }
  const priceMin = filters.priceRange[0];
  const priceMax = filters.priceRange[1];
  const priceFilterActive = priceMin > 0 || priceMax < 9999;
  if (priceFilterActive)
    result = result.filter((product) => {
      if (product.price < priceMin) return false;
      // FIX-SF-F: 9999 é o sentinela "sem limite superior" → ilimitado.
      if (priceMax < 9999 && product.price > priceMax) return false;
      return true;
    });
  if (filters.minStock > 0)
    result = result.filter((product) => {
      if (product.variations && product.variations.length > 0)
        return product.variations.some((v: ProductVariation) => (v.stock ?? 0) >= filters.minStock);
      return (product.stock || 0) >= filters.minStock;
    });
  // Vendas Fornecedor (90d): usa a coluna REAL total_depleted_90d da MV (BUG-DB-06; ratio 90d/30d~1.0, x3 era chute).
  if (filters.minSupplierSales90d > 0 && supplierSalesMap && supplierSalesMap.size > 0) {
    const threshold = filters.minSupplierSales90d;
    result = result.filter((p) => (supplierSalesMap.get(p.id)?.depleted90d ?? 0) >= threshold);
  }
  // Vendas Promo Brindes (90d).
  if (filters.minPromoSales90d > 0 && promoSales90dMap && promoSales90dMap.size > 0) {
    const threshold = filters.minPromoSales90d;
    result = result.filter((p) => (promoSales90dMap.get(p.id) ?? 0) >= threshold);
  }
  // FIX-03: inStock considera variações além do estoque agregado.
  if (filters.inStock)
    result = result.filter((product) => {
      if (product.variations && product.variations.length > 0)
        return product.variations.some((v: ProductVariation) => (v.stock ?? 0) > 0);
      return (product.stock || 0) > 0;
    });
  if (filters.hasCommercialPackaging)
    result = result.filter((product) => product.hasCommercialPackaging === true);
  if (filters.isKit) result = result.filter((product) => isProductKit(product));
  if (filters.featured) result = result.filter((product) => product.featured === true);
  if (filters.isNew) result = result.filter((product) => product.newArrival === true);
  if (filters.hasPersonalization)
    result = result.filter((product) => product.hasPersonalization === true);
  if (filters.onSale) result = result.filter((product) => product.onSale === true);
  if (filters.gender?.length) {
    const genderSet = new Set(filters.gender.map((g) => g.toLowerCase().trim()));
    result = result.filter((product) => genderSet.has((product.gender || '').toLowerCase().trim()));
  }
  // SF-E: filtragem de tamanho server-side (product_variants) quando disponível;
  // fallback legado client-side (product.variations) caso o contexto não traga o Set.
  if (filters.sizes?.length) {
    if (hasSizeFilter && sizeFilteredProductIds) {
      if (sizeFilteredProductIds.size > 0) {
        result = result.filter((p) => sizeFilteredProductIds.has(p.id));
      } else if (!isLoadingSizeFilter && !sizeFilterError) {
        result = [];
      }
    } else {
      // Legado: BUG-17 — match por variações carregadas no produto.
      const sizeSet = new Set(filters.sizes);
      result = result.filter((product) =>
        product.variations?.some(
          (v: ProductVariation) => v.size_code !== null && sizeSet.has(String(v.size_code)),
        ),
      );
    }
  }
  // BUG-SF-02 FIX: tags — match por slug contra qualquer campo de string do produto.
  if (!hasMetadataFilter && filters.tags?.length) {
    const tagIdsLower = filters.tags.map((t) => t.toLowerCase());
    result = result.filter((product) => {
      const allTagValues = [
        ...(product.tags?.publicoAlvo ?? []),
        ...(product.tags?.datasComemorativas ?? []),
        ...(product.tags?.endomarketing ?? []),
        ...(product.tags?.ramo ?? []),
        ...(product.tags?.nicho ?? []),
      ].map((v: string) => v.toLowerCase());
      return tagIdsLower.some((tagId) =>
        allTagValues.some((v) => v === tagId || v.includes(tagId)),
      );
    });
  }
  // BUG-SF-01 / FIX-20: techniques só filtra quando há dados de técnica no produto.
  if (techniquesDataAvailable && filters.techniques?.length) {
    const techSet = new Set(filters.techniques.map((t) => t.toLowerCase()));
    result = result.filter((product) => {
      const metaTechs: string[] = (product.metadata?.techniques as string[]) ?? [];
      if (metaTechs.length > 0) {
        return metaTechs.some((t: string) => techSet.has(t.toLowerCase()));
      }
      return true;
    });
  }
  // BUG-SF-08 FIX: com fuzzy ativo e sort 'name', preserva a ordem de relevância.
  const skipSort = hasFuzzySearch && sortBy === 'name';
  result = sortProducts(result, sortBy, { promoSalesMap, supplierSalesMap, skipSort });
  return result;
}
