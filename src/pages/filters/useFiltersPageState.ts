import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type FilterState, defaultFilters } from '@/components/filters/FilterPanel';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import {
  useColorEnrichment,
  useProductFuzzySearch,
  useProductsByCategory,
  useProductsByColor,
  useProductsByMaterial,
  useProductsCatalog,
  useSupplierSalesRanking,
} from '@/hooks/products';
import { useDebounce } from '@/hooks/common';
import { usePromoSalesRanking } from '@/hooks/intelligence';
import { sortProducts } from '@/utils/product-sorting';
import { toast } from 'sonner';

export function useFiltersPageState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  // Deserialize filters from URL on mount
  const [filters, setFilters] = useState<FilterState>(() => {
    const f = { ...defaultFilters };
    const get = (k: string) => searchParams.get(k);
    const getArr = (k: string) => {
      const v = searchParams.get(k);
      return v ? v.split(',').filter(Boolean) : [];
    };
    const search = get('search');
    if (search) f.search = search;
    const cg = getArr('colorGroups');
    if (cg.length) f.colorGroups = cg;
    const cv = getArr('colorVariations');
    if (cv.length) f.colorVariations = cv;
    const cn = getArr('colorNuances');
    if (cn.length) f.colorNuances = cn;
    const colors = getArr('colors');
    if (colors.length) f.colors = colors;
    const cats = getArr('categories');
    if (cats.length) f.categories = cats;
    const suppliers = getArr('suppliers');
    if (suppliers.length) f.suppliers = suppliers;
    const singleSupplier = get('supplier');
    if (singleSupplier && !f.suppliers.includes(singleSupplier))
      f.suppliers = [...f.suppliers, singleSupplier];
    const pa = getArr('publicoAlvo');
    if (pa.length) f.publicoAlvo = pa;
    const dc = getArr('datasComemorativas');
    if (dc.length) f.datasComemorativas = dc;
    const endo = getArr('endomarketing');
    if (endo.length) f.endomarketing = endo;
    const ra = getArr('ramosAtividade');
    if (ra.length) f.ramosAtividade = ra;
    const sa = getArr('segmentosAtividade');
    if (sa.length) f.segmentosAtividade = sa;
    const mg = getArr('materialGroups');
    if (mg.length) f.materialGroups = mg;
    const mt = getArr('materialTypes');
    if (mt.length) f.materialTypes = mt;
    const mat = getArr('materiais');
    if (mat.length) f.materiais = mat;
    const tech = getArr('techniques');
    if (tech.length) f.techniques = tech;
    const tags = getArr('tags');
    if (tags.length) f.tags = tags;
    const gender = getArr('gender');
    if (gender.length) f.gender = gender;
    const sizes = getArr('sizes');
    if (sizes.length) f.sizes = sizes;
    const pMin = get('priceMin');
    const pMax = get('priceMax');
    if (pMin || pMax) f.priceRange = [pMin ? parseInt(pMin) : 0, pMax ? parseInt(pMax) : 9999];
    const ms = get('minStock');
    if (ms) f.minStock = parseInt(ms);
    if (get('inStock') === '1') f.inStock = true;
    if (get('isKit') === '1') f.isKit = true;
    if (get('featured') === '1') f.featured = true;
    if (get('isNew') === '1') f.isNew = true;
    if (get('hasPersonalization') === '1') f.hasPersonalization = true;
    if (get('hasCommercialPackaging') === '1') f.hasCommercialPackaging = true;
    const sortByParam = get('sortBy');
    if (sortByParam) f.sortBy = sortByParam;
    return f;
  });

  const debouncedServerSearch = useDebounce(filters.search || '', 400);
  const urlSearch = searchParams.get('search') || '';
  const debouncedUrlSearch = useDebounce(urlSearch, 400);
  const serverSearchTerm = debouncedServerSearch || debouncedUrlSearch;

  const {
    data: catalogData,
    isLoading: isLoadingProducts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductsCatalog(serverSearchTerm ? { search: serverSearchTerm } : undefined);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const realProducts = useMemo(
    () => (catalogData?.pages ? catalogData.pages.flatMap((page) => page.products) : []),
    [catalogData],
  );
  const totalEstimate = catalogData?.pages?.[0]?.totalEstimate ?? null;
  const isFullyLoaded = !hasNextPage && !isFetchingNextPage;
  const loadedCount = realProducts.length;
  const loadingProgress =
    totalEstimate && totalEstimate > 0
      ? Math.min(Math.round((loadedCount / totalEstimate) * 100), 100)
      : isFullyLoaded
        ? 100
        : 0;

  // Serialize filters to URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams();
    const setArr = (k: string, arr: string[]) => {
      if (arr.length) params.set(k, arr.join(','));
    };
    if (filters.search) params.set('search', filters.search);
    setArr('colorGroups', filters.colorGroups);
    setArr('colorVariations', filters.colorVariations);
    setArr('colorNuances', filters.colorNuances);
    setArr('colors', filters.colors);
    setArr('categories', filters.categories);
    setArr('suppliers', filters.suppliers);
    setArr('publicoAlvo', filters.publicoAlvo);
    setArr('datasComemorativas', filters.datasComemorativas);
    setArr('endomarketing', filters.endomarketing);
    setArr('ramosAtividade', filters.ramosAtividade || []);
    setArr('segmentosAtividade', filters.segmentosAtividade || []);
    setArr('materialGroups', filters.materialGroups || []);
    setArr('materialTypes', filters.materialTypes || []);
    setArr('materiais', filters.materiais);
    setArr('techniques', filters.techniques || []);
    setArr('tags', filters.tags || []);
    setArr('gender', filters.gender || []);
    setArr('sizes', filters.sizes || []);
    if (filters.priceRange[0] > 0) params.set('priceMin', String(filters.priceRange[0]));
    if (filters.priceRange[1] < 9999) params.set('priceMax', String(filters.priceRange[1]));
    if (filters.minStock > 0) params.set('minStock', String(filters.minStock));
    if (filters.inStock) params.set('inStock', '1');
    if (filters.isKit) params.set('isKit', '1');
    if (filters.featured) params.set('featured', '1');
    if (filters.isNew) params.set('isNew', '1');
    if (filters.hasPersonalization) params.set('hasPersonalization', '1');
    if (filters.hasCommercialPackaging) params.set('hasCommercialPackaging', '1');
    if (filters.sortBy && filters.sortBy !== 'name') params.set('sortBy', filters.sortBy);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const {
    productIds: materialFilteredProductIds,
    hasFilter: hasMaterialFilter,
    isLoading: isLoadingMaterialFilter,
  } = useProductsByMaterial({
    materialGroupSlugs: filters.materialGroups || [],
    materialTypeSlugs: filters.materialTypes || [],
  });
  const {
    productIds: categoryFilteredProductIds,
    hasFilter: hasCategoryFilter,
    isLoading: isLoadingCategoryFilter,
  } = useProductsByCategory({ categoryIds: filters.categories, includeDescendants: true });
  const {
    productIds: colorFilteredProductIds,
    hasFilter: hasColorFilter,
    isLoading: isLoadingColorFilter,
  } = useProductsByColor({
    colorGroups: filters.colorGroups || [],
    colorVariations: filters.colorVariations || [],
    colorNuances: filters.colorNuances || [],
    colors: filters.colors,
  });

  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);

  // Responsive clamp: force appropriate columns on small screens
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640 && gridColumns > 1) {
        setGridColumns(1);
      } else if (w >= 640 && w < 768 && gridColumns > 2) {
        setGridColumns(2);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridColumns]);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [commandAction, setCommandAction] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<
    Array<{
      type: 'category' | 'color' | 'price' | 'material' | 'stock' | 'featured' | 'kit';
      label: string;
    }>
  >([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const filtersJson = JSON.stringify(filters);
  useEffect(() => {
    setIsFiltering(true);
    const timer = setTimeout(() => setIsFiltering(false), 350);
    return () => clearTimeout(timer);
  }, [filtersJson]);

  const sortBy = filters.sortBy || 'name';
  const setSortBy = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, sortBy: value }));
  }, []);

  // Promo Brindes sales ranking (lazy — only fetched when needed)
  const { data: promoSalesMap } = usePromoSalesRanking();
  const { data: supplierSalesMap } = useSupplierSalesRanking();

  const handleApplyPreset = (presetFilters: FilterState, presetId?: string) => {
    setFilters(presetFilters);
    setActivePresetId(presetId);
  };
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setActivePresetId(undefined);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (
      (filters.colorGroups?.length || 0) +
        (filters.colorVariations?.length || 0) +
        (filters.colorNuances?.length || 0) +
        filters.colors.length >
      0
    )
      count++;
    if (filters.categories.length > 0) count++;
    if (filters.suppliers.length > 0) count++;
    if (filters.publicoAlvo.length > 0) count++;
    if (filters.datasComemorativas.length > 0) count++;
    if (filters.endomarketing.length > 0) count++;
    if (filters.ramosAtividade?.length > 0) count++;
    if (filters.segmentosAtividade?.length > 0) count++;
    if (
      (filters.materialGroups?.length || 0) +
        (filters.materialTypes?.length || 0) +
        filters.materiais.length >
      0
    )
      count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) count++;
    if (filters.minStock > 0) count++;
    if (filters.inStock) count++;
    if (filters.isKit) count++;
    if (filters.featured) count++;
    if (filters.isNew) count++;
    if (filters.hasPersonalization) count++;
    if (filters.hasCommercialPackaging) count++;
    if ((filters.techniques?.length || 0) > 0) count++;
    if ((filters.tags?.length || 0) > 0) count++;
    if ((filters.gender?.length || 0) > 0) count++;
    if ((filters.sizes?.length || 0) > 0) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  const handleReset = () => {
    const hadFilters = activeFiltersCount > 0;
    setFilters(defaultFilters);
    setActivePresetId(undefined);
    if (hadFilters)
      toast.success('Filtros limpos', { description: 'Todos os filtros foram removidos.' });
  };

  const searchQuery = searchParams.get('search') || '';
  const { results: fuzzySearchResults, hasSearch: hasFuzzySearch } = useProductFuzzySearch(
    realProducts,
    searchQuery,
  );

  // Apply filters
  const filteredProducts = useMemo(() => {
    let result = hasFuzzySearch ? [...fuzzySearchResults] : [...realProducts];
    if (filters.search) {
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
    else if (hasCategoryFilter && categoryFilteredProductIds.size === 0 && !isLoadingCategoryFilter)
      result = [];
    if (filters.suppliers.length > 0)
      result = result.filter((product) => {
        const sId = product.supplier?.id || '';
        const sName = (product.supplier?.name || product.brand || '').toLowerCase();
        return (
          filters.suppliers.includes(sId) ||
          filters.suppliers.some((s) => sName.includes(s.toLowerCase())) ||
          filters.suppliers.includes(product.supplier_reference || '')
        );
      });
    if (filters.publicoAlvo.length > 0)
      result = result.filter((product) => {
        const tags = product.tags?.publicoAlvo || [];
        return filters.publicoAlvo.some((p) =>
          tags.some((t: string) => t.toLowerCase() === p.toLowerCase()),
        );
      });
    if (filters.datasComemorativas.length > 0)
      result = result.filter((product) => {
        const tags = product.tags?.datasComemorativas || [];
        return filters.datasComemorativas.some((d) =>
          tags.some((t: string) => t.toLowerCase().includes(d.toLowerCase())),
        );
      });
    if (filters.endomarketing.length > 0)
      result = result.filter((product) => {
        const tags = product.tags?.endomarketing || [];
        return filters.endomarketing.some((e) =>
          tags.some((t: string) => t.toLowerCase() === e.toLowerCase()),
        );
      });
    if (filters.ramosAtividade?.length > 0 || filters.segmentosAtividade?.length > 0)
      result = result.filter((product) => {
        const ramos = product.tags?.ramo || [];
        const nichos = product.tags?.nicho || [];
        const matchesRamo = filters.ramosAtividade?.length
          ? filters.ramosAtividade.some((r) =>
              ramos.some((t: string) => t.toLowerCase().includes(r.toLowerCase())),
            )
          : true;
        const matchesSegmento = filters.segmentosAtividade?.length
          ? filters.segmentosAtividade.some((s) =>
              nichos.some((t: string) => t.toLowerCase().includes(s.toLowerCase())),
            )
          : true;
        return matchesRamo || matchesSegmento;
      });
    if (hasMaterialFilter && materialFilteredProductIds.size > 0)
      result = result.filter((p) => materialFilteredProductIds.has(p.id));
    else if (hasMaterialFilter && materialFilteredProductIds.size === 0 && !isLoadingMaterialFilter)
      result = [];
    if (!hasMaterialFilter && filters.materiais.length > 0)
      result = result.filter((product) => {
        const materialsStr = Array.isArray(product.materials)
          ? product.materials.join(' ').toLowerCase()
          : (product.materials || '').toLowerCase();
        return filters.materiais.some((m) => materialsStr.includes(m.toLowerCase()));
      });
    const priceFilterActive = filters.priceRange[0] > 0 || filters.priceRange[1] < 9999;
    if (priceFilterActive)
      result = result.filter(
        (product) =>
          product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1],
      );
    if (filters.minStock > 0)
      result = result.filter((product) => {
        if (product.variations && product.variations.length > 0)
          return product.variations.some(
            (v: Record<string, unknown>) => ((v.stock as number) ?? 0) >= filters.minStock,
          );
        return (product.stock || 0) >= filters.minStock;
      });
    if (filters.inStock) result = result.filter((product) => (product.stock || 0) > 0);
    if (filters.hasCommercialPackaging)
      result = result.filter((product) => product.hasCommercialPackaging === true);
    if (filters.isKit) result = result.filter((product) => product.isKit === true);
    const skipSort = hasFuzzySearch && sortBy === 'name';
    sortProducts(result, sortBy, { promoSalesMap, supplierSalesMap, skipSort });
    return result;
  }, [
    filters,
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
  ]);

  // Color enrichment: fetch variant images/stock for filtered products when color filter is active
  const filteredProductIds = useMemo(() => filteredProducts.map((p) => p.id), [filteredProducts]);
  const { data: colorEnrichmentMap } = useColorEnrichment({
    productIds: filteredProductIds,
    colorGroups: filters.colorGroups || [],
    colorVariations: filters.colorVariations || [],
  });

  // Merge color enrichment data into products
  const enrichedFilteredProducts = useMemo(() => {
    if (!colorEnrichmentMap || colorEnrichmentMap.size === 0) return filteredProducts;
    return filteredProducts.map((product) => {
      const enrichment = colorEnrichmentMap.get(product.id);
      if (!enrichment) return product;
      return {
        ...product,
        // Override image with color-specific image
        ...(enrichment.image
          ? {
              og_image_url: enrichment.image,
              images: [
                enrichment.image,
                ...product.images.filter((img) => img !== enrichment.image),
              ],
            }
          : {}),
        // Override stock with color-specific stock
        stock: enrichment.stock,
        stockStatus: enrichment.stockStatus,
        // Inject color data so resolveColorImage/resolveColorStock work
        colors: enrichment.colorName
          ? [
              {
                name: enrichment.colorName,
                hex: enrichment.colorHex || '#CCCCCC',
                group: enrichment.colorName,
                groupSlug: filters.colorGroups?.[0] || undefined,
                variationSlug: filters.colorVariations?.[0] || undefined,
                image: enrichment.image || undefined,
                images: enrichment.image ? [enrichment.image] : undefined,
              },
            ]
          : product.colors,
      };
    });
  }, [filteredProducts, colorEnrichmentMap, filters.colorGroups, filters.colorVariations]);

  // Search toast
  const prevSearchRef = useRef<string>('');
  useEffect(() => {
    const currentSearch = filters.search || '';
    if (currentSearch && currentSearch !== prevSearchRef.current) {
      toast.info(
        `${enrichedFilteredProducts.length.toLocaleString('pt-BR')} produto${enrichedFilteredProducts.length !== 1 ? 's' : ''} encontrado${enrichedFilteredProducts.length !== 1 ? 's' : ''}`,
        { description: `Busca: "${currentSearch}"`, duration: 3000 },
      );
    }
    prevSearchRef.current = currentSearch;
  }, [filters.search, enrichedFilteredProducts.length]);

  // Active filters summary
  const activeFiltersSummary = useMemo(() => {
    const summary: { label: string; value: string; key: keyof FilterState }[] = [];
    const totalCores =
      (filters.colorGroups?.length || 0) +
      (filters.colorVariations?.length || 0) +
      (filters.colorNuances?.length || 0) +
      filters.colors.length;
    if (totalCores > 0)
      summary.push({
        label: 'Cores',
        value: `${totalCores} selecionada${totalCores > 1 ? 's' : ''}`,
        key: 'colors',
      });
    if (filters.categories.length > 0)
      summary.push({
        label: 'Categorias',
        value: `${filters.categories.length} selecionada${filters.categories.length > 1 ? 's' : ''}`,
        key: 'categories',
      });
    if (filters.suppliers.length > 0)
      summary.push({
        label: 'Fornecedores',
        value: `${filters.suppliers.length} selecionado${filters.suppliers.length > 1 ? 's' : ''}`,
        key: 'suppliers',
      });
    if (filters.publicoAlvo.length > 0)
      summary.push({
        label: 'Público-Alvo',
        value:
          filters.publicoAlvo.slice(0, 2).join(', ') +
          (filters.publicoAlvo.length > 2 ? ` +${filters.publicoAlvo.length - 2}` : ''),
        key: 'publicoAlvo',
      });
    if (filters.datasComemorativas.length > 0)
      summary.push({
        label: 'Datas',
        value: filters.datasComemorativas[0],
        key: 'datasComemorativas',
      });
    if (filters.endomarketing.length > 0)
      summary.push({
        label: 'Endomarketing',
        value: filters.endomarketing.slice(0, 2).join(', '),
        key: 'endomarketing',
      });
    const totalMateriais =
      (filters.materialGroups?.length || 0) +
      (filters.materialTypes?.length || 0) +
      filters.materiais.length;
    if (totalMateriais > 0)
      summary.push({
        label: 'Materiais',
        value: `${totalMateriais} selecionado${totalMateriais > 1 ? 's' : ''}`,
        key: 'materiais',
      });
    const totalRamos =
      (filters.ramosAtividade?.length || 0) + (filters.segmentosAtividade?.length || 0);
    if (totalRamos > 0)
      summary.push({
        label: 'Nichos',
        value: `${totalRamos} selecionado${totalRamos > 1 ? 's' : ''}`,
        key: 'ramosAtividade',
      });
    const genderArr = filters.gender || [];
    if (genderArr.length > 0)
      summary.push({ label: 'Gênero', value: genderArr.join(', '), key: 'gender' });
    const sizesArr = filters.sizes || [];
    if (sizesArr.length > 0)
      summary.push({
        label: 'Tamanhos',
        value: `${sizesArr.length} selecionado${sizesArr.length > 1 ? 's' : ''}`,
        key: 'sizes',
      });
    return summary;
  }, [filters]);

  const clearSingleFilter = (key: keyof FilterState) => {
    if (key === 'colors')
      setFilters({
        ...filters,
        colors: [],
        colorGroups: [],
        colorVariations: [],
        colorNuances: [],
      });
    else if (key === 'materiais')
      setFilters({ ...filters, materiais: [], materialGroups: [], materialTypes: [] });
    else if (key === 'ramosAtividade')
      setFilters({ ...filters, ramosAtividade: [], segmentosAtividade: [] });
    else if (Array.isArray(filters[key])) setFilters({ ...filters, [key]: [] });
    else if (typeof filters[key] === 'boolean') setFilters({ ...filters, [key]: false });
    setActivePresetId(undefined);
  };

  return {
    filters,
    setFilters,
    searchParams,
    realProducts,
    isLoadingProducts,
    isFullyLoaded,
    totalEstimate,
    loadedCount,
    loadingProgress,
    isLoadingMaterialFilter,
    isLoadingCategoryFilter,
    isLoadingColorFilter,
    activePresetId,
    viewMode,
    setViewMode,
    gridColumns,
    setGridColumns,
    selectionMode,
    setSelectionMode,
    voiceOverlayOpen,
    setVoiceOverlayOpen,
    commandAction,
    setCommandAction,
    appliedFilters,
    setAppliedFilters,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    isFiltering,
    sortBy,
    setSortBy,
    filteredProducts: enrichedFilteredProducts,
    activeFiltersCount,
    activeFiltersSummary,
    clearSingleFilter,
    handleReset,
    handleFilterChange,
    handleApplyPreset,
  };
}
