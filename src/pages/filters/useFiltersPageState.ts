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
import { usePromoSales90dByProduct } from '@/hooks/intelligence/usePromoSales90dByProduct';
import { sortProducts } from '@/utils/product-sorting';
import { SORT_OPTIONS } from '@/constants/filters';
import { isProductKit } from '@/lib/products/kit-detection';
import { toast } from 'sonner';
import type { ProductVariation } from '@/types/product-catalog';

// Valores de sortBy aceitos: os expostos na UI (SORT_OPTIONS) + os internos
// suportados pelo pipeline sortProducts (color-match/popularity são definidos
// upstream; name-asc/name-desc são aliases tratados no sorter).
const VALID_SORT_VALUES = new Set<string>([
  ...SORT_OPTIONS.map((o) => o.value),
  'name-asc',
  'name-desc',
  'popularity',
  'color-match',
]);

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
    // FIX-28: validar NaN e fazer clamp (min<=max). Valores inválidos na URL
    // (?priceMin=abc, min>max) caíam como NaN e zeravam a lista sem feedback.
    if (pMin || pMax) {
      const PRICE_MAX = 99999; // Aumentado limite máximo
      const parsedMin = pMin ? parseFloat(pMin) : 0;
      const parsedMax = pMax ? parseFloat(pMax) : PRICE_MAX;
      let min = Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : 0;
      let max = Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : PRICE_MAX;
      if (min > max) [min, max] = [max, min];
      f.priceRange = [min, max];
    }
    const ms = get('minStock');
    if (ms) {
      const parsedMs = parseInt(ms, 10);
      if (Number.isFinite(parsedMs) && parsedMs >= 0) f.minStock = parsedMs;
    }
    const mss = get('minSupplierSales90d') ?? get('minSupplierSales30d'); // back-compat URL
    if (mss) {
      const n = parseInt(mss, 10);
      if (Number.isFinite(n) && n >= 0) f.minSupplierSales90d = n;
    }
    const mps = get('minPromoSales90d');
    if (mps) {
      const n = parseInt(mps, 10);
      if (Number.isFinite(n) && n >= 0) f.minPromoSales90d = n;
    }
    if (get('inStock') === '1') f.inStock = true;
    if (get('isKit') === '1') f.isKit = true;
    if (get('featured') === '1') f.featured = true;
    if (get('isNew') === '1') f.isNew = true;
    if (get('hasPersonalization') === '1') f.hasPersonalization = true;
    if (get('onSale') === '1') f.onSale = true;
    if (get('hasCommercialPackaging') === '1') f.hasCommercialPackaging = true;
    // FIX-28/B5: só aceitar sortBy da URL se for um valor conhecido — evita
    // que o Select fique sem opção correspondente (placeholder vazio) e que o
    // pipeline de sort receba um valor que cai no no-op silencioso.
    //
    // Padrão de ordenação (PO):
    //  - 1º acesso da sessão (sem URL sortBy e sem sessionStorage) → 'newest'.
    //  - Durante a sessão, mantém a última escolha do usuário (sessionStorage).
    //  - URL sortBy (ex.: link compartilhado) sempre vence.
    const sortByParam = get('sortBy');
    if (sortByParam && VALID_SORT_VALUES.has(sortByParam)) {
      f.sortBy = sortByParam;
    } else if (typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem('catalog:sortBy');
      f.sortBy = stored && VALID_SORT_VALUES.has(stored) ? stored : 'newest';
    } else {
      f.sortBy = 'newest';
    }
    return f;
  });

  // BUG-SF-19 FIX: eram dois useDebounce encadeados (filters.search + urlSearch),
  // potencialmente causando latência de 800ms e race conditions.
  // filters.search é fonte primária (imediata após setFilters) — searchParams.get('search')
  // é o fallback para compatibilidade com links externos que chegam com ?search= na URL
  // sem nunca passar por setFilters (first render). Com filters inicializados a partir da URL
  // no useState inicial, filters.search já contém o valor — o fallback é apenas garantia.
  const effectiveSearch = filters.search || (searchParams.get('search') ?? '');
  const serverSearchTerm = useDebounce(effectiveSearch, 400);

  const {
    data: catalogData,
    isLoading: isLoadingProducts,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductsCatalog({
    search: serverSearchTerm,
    categories: filters.categories,
    suppliers: filters.suppliers,
    sortBy: filters.sortBy,
  });

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const realProducts = useMemo(
    () => (catalogData?.pages ? catalogData.pages.flatMap((page) => page.products) : []),
    [catalogData],
  );

  // FIX-20: o filtro de Técnicas só funciona se os produtos carregados trouxerem
  // `metadata.techniques`. Quando nenhum produto tem esse dado (caso do catálogo
  // lightweight atual), selecionar uma técnica não filtra nada — então não
  // devemos contá-la como filtro ativo nem exibir o chip (evita falso positivo).
  // Até existir um hook server-side (useProductsByTechnique), este sinal mantém
  // a UI honesta.
  const techniquesDataAvailable = useMemo(
    () =>
      realProducts.some((p) => ((p.metadata?.techniques as string[] | undefined)?.length || 0) > 0),
    [realProducts],
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
    setArr('ramosAtividade', filters.ramosAtividade ?? []);
    setArr('segmentosAtividade', filters.segmentosAtividade ?? []);
    setArr('materialGroups', filters.materialGroups ?? []);
    setArr('materialTypes', filters.materialTypes ?? []);
    setArr('materiais', filters.materiais);
    setArr('techniques', filters.techniques ?? []);
    setArr('tags', filters.tags ?? []);
    setArr('gender', filters.gender ?? []);
    setArr('sizes', filters.sizes ?? []);
    if (filters.priceRange[0] > 0) params.set('priceMin', String(filters.priceRange[0]));
    if (filters.priceRange[1] < 9999) params.set('priceMax', String(filters.priceRange[1]));
    if (filters.minStock > 0) params.set('minStock', String(filters.minStock));
    if (filters.minSupplierSales90d > 0)
      params.set('minSupplierSales90d', String(filters.minSupplierSales90d));
    if (filters.minPromoSales90d > 0)
      params.set('minPromoSales90d', String(filters.minPromoSales90d));
    if (filters.inStock) params.set('inStock', '1');
    if (filters.isKit) params.set('isKit', '1');
    if (filters.featured) params.set('featured', '1');
    if (filters.isNew) params.set('isNew', '1');
    if (filters.hasPersonalization) params.set('hasPersonalization', '1');
    if (filters.onSale) params.set('onSale', '1');
    if (filters.hasCommercialPackaging) params.set('hasCommercialPackaging', '1');
    if (filters.sortBy && filters.sortBy !== 'newest') params.set('sortBy', filters.sortBy);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const {
    productIds: materialFilteredProductIds,
    hasFilter: hasMaterialFilter,
    isLoading: isLoadingMaterialFilter,
  } = useProductsByMaterial({
    materialGroupSlugs: filters.materialGroups ?? [],
    materialTypeSlugs: filters.materialTypes ?? [],
  });
  const {
    productIds: categoryFilteredProductIds,
    hasFilter: hasCategoryFilter,
    isLoading: isLoadingCategoryFilter,
    error: categoryFilterError,
  } = useProductsByCategory({ categoryIds: filters.categories, includeDescendants: true });
  const {
    productIds: colorFilteredProductIds,
    hasFilter: hasColorFilter,
    isLoading: isLoadingColorFilter,
  } = useProductsByColor({
    colorGroups: filters.colorGroups ?? [],
    colorVariations: filters.colorVariations ?? [],
    colorNuances: filters.colorNuances ?? [],
    colors: filters.colors,
  });

  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [gridColumns, setGridColumns] = useState<ColumnCount>(getDefaultColumns);

  // Responsive clamp: use ref so the listener doesn't re-register on every column change
  const gridColumnsRef = useRef(gridColumns);
  gridColumnsRef.current = gridColumns;
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && gridColumnsRef.current > 3) setGridColumns(3);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []); // empty deps — handler uses ref to avoid stale closure
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

  const sortBy = filters.sortBy || 'newest';
  const setSortBy = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, sortBy: value }));
    // Persiste a escolha do usuário durante a sessão (limpo no logout/nova aba).
    if (typeof window !== 'undefined' && VALID_SORT_VALUES.has(value)) {
      try {
        window.sessionStorage.setItem('catalog:sortBy', value);
      } catch {
        /* sessionStorage indisponível — ignora */
      }
    }
  }, []);

  // Promo Brindes sales ranking (lazy — only fetched when needed)
  const { data: promoSalesMap } = usePromoSalesRanking();
  const { data: supplierSalesMap } = useSupplierSalesRanking();
  const { data: promoSales90dMap } = usePromoSales90dByProduct();

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
    if (filters.minSupplierSales90d > 0) count++;
    if (filters.minPromoSales90d > 0) count++;
    if (filters.inStock) count++;
    if (filters.isKit) count++;
    if (filters.featured) count++;
    if (filters.isNew) count++;
    if (filters.hasPersonalization) count++;
    if (filters.onSale) count++;
    if (filters.hasCommercialPackaging) count++;
    if (techniquesDataAvailable && (filters.techniques?.length || 0) > 0) count++;
    if ((filters.tags?.length || 0) > 0) count++;
    if ((filters.gender?.length || 0) > 0) count++;
    if ((filters.sizes?.length || 0) > 0) count++;
    if (filters.search) count++;
    return count;
  }, [filters, techniquesDataAvailable]);

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
  const fuzzySearchQuery = filters.search || (searchParams.get('search') ?? '');
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
        if (supplierIdSet.has(product.supplier_reference ?? '')) return true;
        const sName = (product.supplier?.name || (product.brand ?? '')).toLowerCase();
        return supplierLowerArr.some((s) => sName.includes(s));
      });
    }
    if (filters.publicoAlvo.length > 0) {
      const pSet = new Set(filters.publicoAlvo.map((p) => p.toLowerCase()));
      result = result.filter((product) =>
        (product.tags?.publicoAlvo ?? []).some((t: string) => pSet.has(t.toLowerCase())),
      );
    }
    if (filters.datasComemorativas.length > 0) {
      const dcLower = filters.datasComemorativas.map((d) => d.toLowerCase());
      result = result.filter((product) =>
        (product.tags?.datasComemorativas ?? []).some((t: string) => {
          const tl = t.toLowerCase();
          return dcLower.some((d) => tl.includes(d));
        }),
      );
    }
    if (filters.endomarketing.length > 0) {
      const eSet = new Set(filters.endomarketing.map((e) => e.toLowerCase()));
      result = result.filter((product) =>
        (product.tags?.endomarketing ?? []).some((t: string) => eSet.has(t.toLowerCase())),
      );
    }
    if (filters.ramosAtividade?.length > 0 || filters.segmentosAtividade?.length > 0) {
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
    // Vendas Fornecedor (90d): aproxima 90d como depleted30d * 3 (MV expõe apenas total_depleted_30d).
    // Padroniza janela com o filtro Promo Brindes (90d). Map inerte enquanto carrega.
    if (filters.minSupplierSales90d > 0 && supplierSalesMap && supplierSalesMap.size > 0) {
      const threshold = filters.minSupplierSales90d;
      result = result.filter(
        (p) => (supplierSalesMap.get(p.id)?.depleted30d ?? 0) * 3 >= threshold,
      );
    }
    // Vendas Promo Brindes (90d): soma de order_items.quantity por product_id, últimos 90d.
    if (filters.minPromoSales90d > 0 && promoSales90dMap && promoSales90dMap.size > 0) {
      const threshold = filters.minPromoSales90d;
      result = result.filter((p) => (promoSales90dMap.get(p.id) ?? 0) >= threshold);
    }
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
    if (filters.isKit) result = result.filter((product) => isProductKit(product));
    // BUG-15a FIX: featured era contabilizado/chipeado mas nunca filtrava produtos.
    if (filters.featured) result = result.filter((product) => product.featured === true);
    // BUG-15b FIX: isNew mapeia para product.newArrival (campo correto no tipo Product).
    if (filters.isNew) result = result.filter((product) => product.newArrival === true);
    // BUG-15c FIX (parte 2): hasPersonalization — tipo corrigido em commit anterior; filtro aplicado aqui.
    if (filters.hasPersonalization)
      result = result.filter((product) => product.hasPersonalization === true);
    if (filters.onSale) result = result.filter((product) => product.onSale === true);
    // BUG-16 FIX: gender era contabilizado/chipeado mas sem bloco de filtro.
    if (filters.gender?.length) {
      const genderSet = new Set(filters.gender.map((g) => g.toLowerCase().trim()));
      result = result.filter((product) =>
        genderSet.has((product.gender ?? '').toLowerCase().trim()),
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
    // BUG-SF-01 FIX: techniques era contabilizado/chipeado mas sem bloco de filtro.
    // O campo techniques não existe diretamente no Product lightweight — filtro
    // client-side faz match pelo ID/nome da técnica no metadata do produto.
    // Para filtro server-side completo, implementar useProductsByTechnique hook.
    // FIX-20: só aplica o filtro quando há dados de técnica nos produtos
    // (techniquesDataAvailable). Sem dados, o filtro era um no-op que ainda
    // contava como ativo/chip — agora a seleção é inerte de forma consistente
    // (não conta, não chipa, não filtra) até existir suporte server-side.
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
    // BUG-SF-08 FIX: era só === 'name', deve incluir 'relevance' (consistente com useCatalogFiltering).
    // Com busca fuzzy ativa, a relevância já está na ordem dos resultados — não aplicar sort extra.
    const skipSort = hasFuzzySearch && sortBy === 'name';
    sortProducts(result, sortBy, { promoSalesMap, supplierSalesMap, skipSort });
    return result;
  }, [
    filters,
    sortBy,
    hasFuzzySearch,
    fuzzySearchResults,
    realProducts,
    techniquesDataAvailable,
    hasMaterialFilter,
    materialFilteredProductIds,
    isLoadingMaterialFilter,
    hasCategoryFilter,
    categoryFilteredProductIds,
    isLoadingCategoryFilter,
    categoryFilterError,
    hasColorFilter,
    colorFilteredProductIds,
    isLoadingColorFilter,
    promoSalesMap,
    supplierSalesMap,
    promoSales90dMap,
  ]);

  // Color enrichment: fetch variant images/stock for filtered products when color filter is active
  const filteredProductIds = useMemo(() => filteredProducts.map((p) => p.id), [filteredProducts]);
  const { data: colorEnrichmentMap } = useColorEnrichment({
    productIds: filteredProductIds,
    colorGroups: filters.colorGroups ?? [],
    colorVariations: filters.colorVariations ?? [],
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
    const currentSearch = filters.search ?? '';
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
    const genderArr = filters.gender ?? [];
    if (genderArr.length > 0)
      summary.push({ label: 'Gênero', value: genderArr.join(', '), key: 'gender' });
    const sizesArr = filters.sizes ?? [];
    if (sizesArr.length > 0)
      summary.push({
        label: 'Tamanhos',
        value: `${sizesArr.length} selecionado${sizesArr.length > 1 ? 's' : ''}`,
        key: 'sizes',
      });
    // Tipos ausentes no original — FIX-05:
    const techArr = filters.techniques ?? [];
    if (techArr.length > 0 && techniquesDataAvailable)
      summary.push({
        label: 'Técnicas',
        value: `${techArr.length} selecionada${techArr.length > 1 ? 's' : ''}`,
        key: 'techniques',
      });
    const tagsArr = filters.tags ?? [];
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
    if (filters.minSupplierSales90d > 0)
      summary.push({
        label: 'Vendas fornec.',
        value: `≥ ${filters.minSupplierSales90d} un./90d`,
        key: 'minSupplierSales90d',
      });
    if (filters.minPromoSales90d > 0)
      summary.push({
        label: 'Vendas Promo',
        value: `≥ ${filters.minPromoSales90d} un./90d`,
        key: 'minPromoSales90d',
      });
    if (filters.inStock) summary.push({ label: 'Em estoque', value: 'Sim', key: 'inStock' });
    if (filters.isKit) summary.push({ label: 'Kit', value: 'Sim', key: 'isKit' });
    if (filters.featured) summary.push({ label: 'Destaque', value: 'Sim', key: 'featured' });
    if (filters.isNew) summary.push({ label: 'Lançamento', value: 'Sim', key: 'isNew' });
    if (filters.hasPersonalization)
      summary.push({ label: 'Personalizável', value: 'Sim', key: 'hasPersonalization' });
    if (filters.onSale) summary.push({ label: 'Em Oferta', value: 'Sim', key: 'onSale' });
    if (filters.hasCommercialPackaging)
      summary.push({ label: 'Embalagem', value: 'Comercial', key: 'hasCommercialPackaging' });
    if (filters.search)
      summary.push({ label: 'Busca', value: `"${filters.search}"`, key: 'search' });
    return summary;
  }, [filters, techniquesDataAvailable]);

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
