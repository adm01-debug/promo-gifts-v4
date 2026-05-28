import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { type FilterState, defaultFilters } from '@/components/filters/FilterPanel';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import { useColorEnrichment } from '@/hooks/products/useColorEnrichment';
import { useProductFuzzySearch } from '@/hooks/products/useProductFuzzySearch';
import { useProductsByCategory } from '@/hooks/products/useProductsByCategory';
import { useProductsByColor } from '@/hooks/products/useProductsByColor';
import { useProductsByMaterial } from '@/hooks/products/useProductsByMaterial';
import { useProductsCatalog } from '@/hooks/products/useProductsLightweight';
import { useSupplierSalesRanking } from '@/hooks/products/useSupplierSalesRanking';
import { useDebounce } from '@/hooks/common/useDebounce';
import { usePromoSalesRanking } from '@/hooks/intelligence/usePromoSalesRanking';
import { sortProducts } from '@/utils/product-sorting';
import { toast } from 'sonner';
import type { ProductVariation } from '@/types/product-catalog';

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
    // FIX-04: usar parseFloat para preservar centavos (ex: "15.99" → 15.99, não 15)
    if (pMin || pMax) f.priceRange = [pMin ? parseFloat(pMin) : 0, pMax ? parseFloat(pMax) : 9999];
    const ms = get('minStock');
    if (ms) f.minStock = parseInt(ms); // minStock é sempre inteiro — parseInt ok
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

  // BUG-SF-19 FIX: eram dois useDebounce encadeados (filters.search + urlSearch),
  // potencialmente causando latência de 800ms e race conditions.
  // filters.search é fonte primária (imediata após setFilters) — searchParams.get('search')
  // é o fallback para compatibilidade com links externos que chegam com ?search= na URL
  // sem nunca passar por setFilters (first render). Com filters inicializados a partir da URL
  // no useState inicial, filters.search já contém o valor — o fallback é apenas garantia.
  const effectiveSearch = filters.search || searchParams.get('search') || '';
  const serverSearchTerm = useDebounce(effectiveSearch, 400);

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
      if (w < 768 && gridColumns > 3) {
        setGridColumns(3);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridColumns]);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [commandAction, setCommandAction] = useState<string | null>(null);
  // FIX-12: removido estado 'appliedFilters' — declarado mas nunca consumido (dead code).
  // Era exportado no return mas nenhum consumer o utilizava, gerando re-renders desnecessários.
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

  // BUG-20 FIX: usar filters.search como fonte primária (imediata) em vez de
  // searchParams.get('search') que fica stale por 1 render frame após setFilters.
  // O fallback para searchParams mantém compatibilidade com links diretos via URL.
  const fuzzySearchQuery = filters.search || searchParams.get('search') || '';
  const { results: fuzzySearchResults, hasSearch: hasFuzzySearch } = useProductFuzzySearch(
    realProducts,
    fuzzySearchQuery,
  );

  // Apply filters
  const filteredProducts = useMemo(() => {
    let result = hasFuzzySearch ? [...fuzzySearchResults] : [...realProducts];

    // FIX-01: filtro de busca substring só aplica quando NÃO há fuzzy search ativo.
    // Antes, o substring filter rodava SEMPRE, eliminando resultados fuzzy corretos
    // (ex: "sqz" encontrava "Squeeze" via fuzzy, mas .includes("sqz") === false matava o item).
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
        // BUG-SF-06 FIX: era OR — produto passava se correspondesse a ramo OU segmento.
        // Correto é AND: produto deve corresponder ao ramo E ao segmento selecionados.
        // Se apenas um dos filtros está ativo, o outro default é true (sem restrição).
        return matchesRamo && matchesSegmento;
      });
    if (hasMaterialFilter && materialFilteredProductIds.size > 0)
      result = result.filter((p) => materialFilteredProductIds.has(p.id));
    else if (hasMaterialFilter && materialFilteredProductIds.size === 0 && !isLoadingMaterialFilter)
      result = [];
    if (!hasMaterialFilter && filters.materiais.length > 0)
      result = result.filter((product) => {
        const materialsStr = product.materials.join(' ').toLowerCase();
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
            (v: ProductVariation) => (v.stock ?? 0) >= filters.minStock,
          );
        return (product.stock || 0) >= filters.minStock;
      });
    // FIX-03: verificar variações além do estoque agregado.
    // Produto com stock=0 mas com variações em estoque era incorretamente excluído.
    if (filters.inStock)
      result = result.filter((product) => {
        if (product.variations && product.variations.length > 0)
          return product.variations.some((v: ProductVariation) => (v.stock ?? 0) > 0);
        return (product.stock || 0) > 0;
      });
    if (filters.hasCommercialPackaging)
      result = result.filter((product) => product.hasCommercialPackaging === true);
    if (filters.isKit) result = result.filter((product) => product.isKit === true);
    // BUG-15a FIX: featured era contabilizado/chipeado mas nunca filtrava produtos.
    if (filters.featured) result = result.filter((product) => product.featured === true);
    // BUG-15b FIX: isNew mapeia para product.newArrival (campo correto no tipo Product).
    if (filters.isNew) result = result.filter((product) => product.newArrival === true);
    // BUG-15c FIX (parte 2): hasPersonalization — tipo corrigido em commit anterior; filtro aplicado aqui.
    if (filters.hasPersonalization)
      result = result.filter((product) => product.hasPersonalization === true);
    // BUG-16 FIX: gender era contabilizado/chipeado mas sem bloco de filtro.
    if (filters.gender?.length) {
      const genderSet = new Set(filters.gender.map((g) => g.toLowerCase().trim()));
      result = result.filter((product) =>
        genderSet.has((product.gender || '').toLowerCase().trim()),
      );
    }
    // BUG-17 FIX: sizes era contabilizado/chipeado mas sem bloco de filtro.
    if (filters.sizes?.length) {
      const sizeSet = new Set(filters.sizes);
      result = result.filter((product) =>
        product.variations?.some(
          (v: ProductVariation) => v.size_code !== null && sizeSet.has(String(v.size_code)),
        ),
      );
    }
    // BUG-SF-02 FIX: tags era contabilizado/chipeado mas sem bloco de filtro.
    // Produto.tags é um objeto estruturado (publicoAlvo, ramo, etc.) — não tem campo de tags genérico.
    // Aqui fazemos match pelo slug do tag versus qualquer campo de string do produto.
    if (filters.tags?.length) {
      result = result.filter((product) => {
        // Tenta match nos campos de tag do produto via ID ou valor
        const allTagValues = [
          ...(product.tags?.publicoAlvo || []),
          ...(product.tags?.datasComemorativas || []),
          ...(product.tags?.endomarketing || []),
          ...(product.tags?.ramo || []),
          ...(product.tags?.nicho || []),
        ].map((v: string) => v.toLowerCase());
        // Se o ID da tag bater com algum valor de tag do produto, inclui o produto
        return filters.tags.some((tagId) => {
          const tagIdLower = tagId.toLowerCase();
          return allTagValues.some((v) => v === tagIdLower || v.includes(tagIdLower));
        });
      });
    }
    // BUG-SF-01 FIX: techniques era contabilizado/chipeado mas sem bloco de filtro.
    // O campo techniques não existe diretamente no Product lightweight — filtro
    // client-side faz match pelo ID/nome da técnica no metadata do produto.
    // Para filtro server-side completo, implementar useProductsByTechnique hook.
    if (filters.techniques?.length) {
      const techSet = new Set(filters.techniques.map((t) => t.toLowerCase()));
      result = result.filter((product) => {
        // Tenta match via metadata.techniques (se disponível no produto enriquecido)
        const metaTechs: string[] = (product.metadata?.techniques as string[]) || [];
        if (metaTechs.length > 0) {
          return metaTechs.some((t: string) => techSet.has(t.toLowerCase()));
        }
        // Fallback: sem dados de técnica no produto — não filtra (inclui o produto)
        // para não esconder produtos válidos enquanto o hook server-side não existe.
        return true;
      });
    }
    // BUG-SF-08 FIX: era só === 'name', deve incluir 'relevance' (consistente com useCatalogFiltering).
    // Com busca fuzzy ativa, a relevância já está na ordem dos resultados — não aplicar sort extra.
    const skipSort = hasFuzzySearch && (sortBy === 'name' || sortBy === 'relevance');
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
  // FIX-05: adicionados 11 tipos ausentes (priceRange, minStock, inStock, isKit, featured,
  // isNew, hasPersonalization, hasCommercialPackaging, search, techniques, tags).
  // Chips removíveis no cabeçalho não apareciam para esses filtros.
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
    // Tipos ausentes no original — FIX-05:
    const techArr = filters.techniques || [];
    if (techArr.length > 0)
      summary.push({
        label: 'Técnicas',
        value: `${techArr.length} selecionada${techArr.length > 1 ? 's' : ''}`,
        key: 'techniques',
      });
    const tagsArr = filters.tags || [];
    if (tagsArr.length > 0)
      summary.push({
        label: 'Tags',
        value: `${tagsArr.length} selecionada${tagsArr.length > 1 ? 's' : ''}`,
        key: 'tags',
      });
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) {
      const min = filters.priceRange[0] > 0 ? `R$${filters.priceRange[0]}` : '';
      const max = filters.priceRange[1] < 9999 ? `R$${filters.priceRange[1]}` : '';
      summary.push({
        label: 'Preço',
        value: min && max ? `${min}–${max}` : min || max,
        key: 'priceRange',
      });
    }
    if (filters.minStock > 0)
      summary.push({ label: 'Estoque mín.', value: `${filters.minStock} un.`, key: 'minStock' });
    if (filters.inStock) summary.push({ label: 'Em estoque', value: 'Sim', key: 'inStock' });
    if (filters.isKit) summary.push({ label: 'Kit', value: 'Sim', key: 'isKit' });
    if (filters.featured) summary.push({ label: 'Destaque', value: 'Sim', key: 'featured' });
    if (filters.isNew) summary.push({ label: 'Lançamento', value: 'Sim', key: 'isNew' });
    if (filters.hasPersonalization)
      summary.push({ label: 'Personalizável', value: 'Sim', key: 'hasPersonalization' });
    if (filters.hasCommercialPackaging)
      summary.push({ label: 'Embalagem', value: 'Comercial', key: 'hasCommercialPackaging' });
    if (filters.search)
      summary.push({ label: 'Busca', value: `"${filters.search}"`, key: 'search' });
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
    // FIX-02: priceRange precisa de valor sentinela [0,9999], não [] (que causaria crash downstream).
    else if (key === 'priceRange') setFilters({ ...filters, priceRange: [0, 9999] });
    // FIX-02 (cont): search é string, não boolean nem array.
    else if (key === 'search') setFilters({ ...filters, search: '' });
    else if (Array.isArray(filters[key])) setFilters({ ...filters, [key]: [] });
    else if (typeof filters[key] === 'boolean') setFilters({ ...filters, [key]: false });
    else if (typeof filters[key] === 'number') setFilters({ ...filters, [key]: 0 });
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
    // FIX-12: appliedFilters/setAppliedFilters removidos (dead code — nenhum consumer)
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
