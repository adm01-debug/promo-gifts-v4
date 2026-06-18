/**
 * useCatalogState — all catalog page state & logic extracted from Index.tsx
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCatalogRealStats } from '@/hooks/products/useCatalogRealStats';
import { useColorEnrichment } from '@/hooks/products/useColorEnrichment';
import { useExternalCategoriesQuery } from '@/hooks/products/useExternalCategoriesQuery';
import { useProductFuzzySearch } from '@/hooks/products/useProductFuzzySearch';
import { useProductsByCategory } from '@/hooks/products/useProductsByCategory';
import { useProductsByMaterial } from '@/hooks/products/useProductsByMaterial';
import { useProductsCatalog } from '@/hooks/products/useProductsLightweight';
import { useSupplierSalesRanking } from '@/hooks/products/useSupplierSalesRanking';
import type { Product } from '@/types/product-catalog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Heart, Users, Palette, FolderTree } from 'lucide-react';

import { defaultFilters, type FilterState } from '@/components/filters/FilterPanel';
import {
  getDefaultColumns,
  STORAGE_KEY as GRID_COLUMNS_KEY,
  type ColumnCount,
} from '@/components/products/ColumnSelector';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useDebounce } from '@/hooks/common/useDebounce';
import { useSearch } from '@/hooks/common/useSearch';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useFavoriteQuickAdd } from '@/hooks/favorites';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useToast } from '@/hooks/ui/use-toast';
import { usePromoSalesRanking } from '@/hooks/intelligence/usePromoSalesRanking';
import { useCatalogFiltering } from '@/hooks/products/useCatalogFiltering';
import { useCatalogPreferences } from '@/hooks/products/useCatalogPreferences';
import { useProductAnalytics } from '@/hooks/products/useProductAnalytics';
// BUG-SORT-01 FIX: importar SORT_OPTIONS para derivar VALID_SORT_VALUES e
// validar sort params de URL/localStorage antes de aplicar ao state.
import { SORT_OPTIONS } from '@/constants/filters';
// Reset diário de defaults do catálogo (regra do PO): no primeiro acesso
// do dia, viewMode='grid', colunas=6, sortBy='newest'.
import { ensureDailyCatalogDefaults } from '@/hooks/products/dailyCatalogDefaults';

export type ViewMode = 'grid' | 'list' | 'table';
export type SortOption =
  | 'name'
  | 'price-asc'
  | 'price-desc'
  | 'stock'
  | 'newest'
  | 'color-match'
  | 'best-seller-supplier'
  | 'best-seller-promo';

const VIEW_MODE_KEY = 'catalog-view-mode';
const SORT_SESSION_KEY = 'catalog:sortBy';

// BUG-SORT-01 FIX: Conjunto dos valores válidos derivado do SSOT (SORT_OPTIONS).
// Declarado fora do hook para não ser recriado a cada render.
const VALID_SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

function getSessionSortPreference(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SORT_SESSION_KEY) : null;
  } catch {
    return null;
  }
}

function setSessionSortPreference(sortBy: SortOption): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(SORT_SESSION_KEY, sortBy);
  } catch {
    /* sessionStorage indisponivel — mantém somente em memoria */
  }
}

/**
 * BUG-SORT-09 FIX: Mapa de aliases conhecidos → valores canônicos de SortOption.
 * Permite que sistemas externos (voice agent, URL compartilhada) usem nomes
 * alternativos que são normalizados antes de ser aplicados ao state.
 * Sem este mapa, validateSortOption rejeitava aliases e o URL sync effect revertia
 * silenciosamente o sort para 'name', descartando a intenção do voice agent.
 * Ex: voice agent envia sortBy='popularity' → normaliza para 'best-seller-promo'.
 */
const SORT_ALIASES: Readonly<Record<string, SortOption>> = {
  popularity: 'best-seller-promo', // alias do voice agent
  relevance: 'name', // valor legado da versão anterior do app
} as const;

/**
 * BUG-SORT-01 FIX: Valida e normaliza um sort value arbitrário.
 * BUG-SORT-09 FIX: Normaliza aliases conhecidos para o valor canônico antes
 * de validar no SSOT. Retorna 'newest' (default seguro) para qualquer valor
 * inválido, nulo ou ausente. Previne que URL params corrompidos ou aliases
 * de voice agent quebrem o Select UI e o URL sync loop.
 */
export function validateSortOption(s: string | null | undefined): SortOption {
  if (!s) return 'newest';
  // BUG-SORT-09 FIX: normalizar alias → canonical antes de validar no SSOT.
  // BUG-SORT-12 FIX (prototype pollution): NAO usar o operador `in` aqui — ele
  // percorre a cadeia de prototipos, entao `?sort=toString`/`?sort=constructor`
  // resolviam para Object.prototype.toString / Object (uma FUNCAO), que vazava
  // para o state, URL sync e <Select value>. Object.hasOwn seria ideal mas e
  // ES2022 e o tsconfig.app usa lib ES2020; hasOwnProperty.call e ES5, sempre
  // tipado, e considera apenas chaves proprias do objeto literal.
  if (Object.prototype.hasOwnProperty.call(SORT_ALIASES, s)) {
    return SORT_ALIASES[s as keyof typeof SORT_ALIASES];
  }
  if (VALID_SORT_VALUES.has(s)) return s as SortOption;
  return 'newest';
}

function getPersistedViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'list' || saved === 'table') return saved;
  } catch {
    /* empty */
  }
  return 'grid';
}

const ITEMS_PER_PAGE = 500;

export function useCatalogState() {
  // PO rule: primeiro acesso do dia → grid 6 colunas + sort 'Mais recentes'.
  // Roda ANTES dos useState para que os inicializadores leiam os defaults.
  // Idempotente após o primeiro acesso do dia (marca em localStorage).
  ensureDailyCatalogDefaults();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite: baseToggleFavorite, favoriteCount } = useFavoritesStore();
  const favQuickAdd = useFavoriteQuickAdd();
  const { isInCompare, toggleCompare: baseToggleCompare, canAddMore } = useComparisonStore();

  const toggleFavorite = useCallback(
    (productId: string) => {
      baseToggleFavorite(productId);
    },
    [baseToggleFavorite],
  );

  const toggleCompare = useCallback(
    (productId: string) => {
      return baseToggleCompare(productId);
    },
    [baseToggleCompare],
  );
  const { registerProducts } = useProductsContext();
  const { data: promoSalesMap } = usePromoSalesRanking();
  const { data: supplierSalesMap } = useSupplierSalesRanking();
  const { updatePreferences } = useCatalogPreferences();
  // GAP-2 v2 (Copilot review PR #690): ref em vez de useState — snapshot não
  // dispara render extra (ref não re-renderiza) e a escrita via effect é
  // concurrent-safe. O valor só é LIDO quando isTransitioning=true.
  const lastNonTransitionedProductsRef = useRef<Product[]>([]);
  const { trackSort, trackSearch } = useProductAnalytics();

  const searchQueryFromUrl = searchParams.get('search') ?? '';

  // Refs para furar a TDZ (temporal dead zone): tanto `setSortBy` quanto o
  // effect de `searchQueryFromUrl` precisam de `filteredProducts`/`searchQuery`,
  // mas ambos são declarados MAIS ABAIXO neste hook. Referenciar a const
  // diretamente (mesmo só nas deps) dispara "Cannot access 'filteredProducts'
  // before initialization" e derruba a página. Lemos via ref — sempre o valor
  // atual, sincronizado por effect após as declarações reais.
  const filteredProductsRef = useRef<Product[]>([]);
  const searchQueryRef = useRef('');

  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [viewMode, setViewModeState] = useState<ViewMode>(getPersistedViewMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* empty */
    }
  }, []);
  const [gridColumns, setGridColumnsState] = useState<ColumnCount>(getDefaultColumns);
  const setGridColumns = useCallback((cols: ColumnCount) => {
    setGridColumnsState(cols);
    try {
      localStorage.setItem(GRID_COLUMNS_KEY, String(cols));
    } catch {
      /* empty */
    }
  }, []);

  // BUG-SORT-01 FIX: Validar o sort param da URL e o valor de preferência antes
  // de usá-los como estado inicial. O cast `as SortOption` anterior não tinha
  // runtime check — valores stale (ex: 'relevance') ou corrompidos eram aceitos.
  const rawUrlSort = searchParams.get('sort');
  const initialSortBy: SortOption = rawUrlSort
    ? validateSortOption(rawUrlSort)
    : validateSortOption(getSessionSortPreference());

  const [sortBy, setSortByState] = useState<SortOption>(initialSortBy);
  const pendingLocalSortRef = useRef<SortOption | null>(null);

  // Sync sortBy with the current browser session only.
  // PO rule: a fresh login/tab starts in "Mais Recentes"; old cloud/local prefs must not override it.
  useEffect(() => {
    const storedSort = getSessionSortPreference();
    if (storedSort && !searchParams.get('sort')) {
      setSortByState(validateSortOption(storedSort));
    }
  }, [searchParams]);

  const setSortBy = useCallback(
    (s: SortOption | string) => {
      // Valida/normaliza na borda: aceita string de qualquer caller (FilterBar,
      // voice agent, URL) e aplica apenas valores canônicos de SortOption.
      // Resolve TS2322 em Index.tsx (onSortChange espera (v: string) => void)
      // e protege o state contra valores inválidos em runtime.
      const validated = validateSortOption(s);
      if (validated === sortBy) return;
      setIsTransitioning(true);
      pendingLocalSortRef.current = validated;
      setSessionSortPreference(validated);
      setSortByState(validated);
    },
    [sortBy],
  );

  // BUG-G10 FIX: Consolidate side-effects (URL, Preferences, Analytics)
  // into a single effect reactive to sortBy changes.
  const lastSortByRef = useRef<SortOption>(initialSortBy);
  useEffect(() => {
    if (sortBy === lastSortByRef.current) return;

    const previousSort = lastSortByRef.current;
    lastSortByRef.current = sortBy;

    // 1. Update Preferences
    updatePreferences({ sortBy });

    // 2. Update URL
    const newParams = new URLSearchParams(window.location.search);
    if (sortBy === 'newest') {
      // BUG-SORT-04 FIX [CRÍTICO]: Remover o param 'sort' ao reverter para o default.
      // Antes: bloco vazio deixava '?sort=price-asc' na URL quando o usuário
      // selecionava 'Mais Recentes'. O URL sync effect lia o param stale e revertia
      // o state imediatamente — tornando impossível selecionar o item default.
      newParams.delete('sort');
    } else {
      newParams.set('sort', sortBy);
    }
    const newPath = `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`;
    navigate(newPath, { replace: true });

    // 3. Analytics
    trackSort({
      sortBy,
      previousSortBy: previousSort,
      resultsCount: filteredProductsRef.current.length,
      hasSearch: !!searchQueryRef.current.trim(),
    });

    setIsTransitioning(false);
  }, [sortBy, updatePreferences, navigate, trackSort]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedCount(0);
      return !prev;
    });
  }, []);

  // Responsive clamp: garante que o numero de colunas nao ultrapasse o disponivel
  // para a largura atual da tela, mantendo a consistencia visual.
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let maxCols: ColumnCount = 3;
      if (w >= 1536) maxCols = 8;
      else if (w >= 1280) maxCols = 6;
      else if (w >= 1024) maxCols = 5;
      else if (w >= 768) maxCols = 4;

      if (gridColumns > maxCols) {
        setGridColumns(maxCols);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridColumns, setGridColumns]);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchQueryFromUrl);
  const [isSearching, setIsSearching] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Mantém searchQueryRef sincronizado (consumido por setSortBy via ref).
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const debouncedSearch = useDebounce(searchQuery, 400);
  const debouncedServerSearch = debouncedSearch;

  const {
    data: catalogData,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchCatalog,
  } = useProductsCatalog({
    search: debouncedServerSearch,
    categories: filters.categories,
    suppliers: filters.suppliers,
    sortBy,
  });

  const realProducts = useMemo(() => {
    if (!catalogData?.pages) return [] as Product[];
    return catalogData.pages.flatMap((page) => page.products);
  }, [catalogData]);

  const totalEstimate = catalogData?.pages?.[0]?.totalEstimate ?? null;

  // BUG-CS-03 FIX: Guard against multiple simultaneous prefetch calls.
  // Original enqueued a new requestIdleCallback every time hasNextPage changed,
  // causing duplicated fetchNextPage calls.
  const prefetchScheduledRef = useRef(false);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !prefetchScheduledRef.current) {
      prefetchScheduledRef.current = true;
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          fetchNextPage().finally(() => {
            prefetchScheduledRef.current = false;
          });
        });
      } else {
        const prefetchTimer = setTimeout(() => {
          fetchNextPage().finally(() => {
            prefetchScheduledRef.current = false;
          });
        }, 1000);
        return () => {
          clearTimeout(prefetchTimer);
          prefetchScheduledRef.current = false;
        };
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (realProducts.length > 0) registerProducts(realProducts);
  }, [realProducts, registerProducts]);

  const { suggestions, quickSuggestions, history, addToHistory, clearHistory } =
    useSearch(realProducts);

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
  } = useProductsByCategory({
    categoryIds: filters.categories?.map(String) ?? [],
    includeDescendants: true,
  });

  useExternalCategoriesQuery();
  const { data: realStats } = useCatalogRealStats();

  const isLoading = isLoadingProducts || isLoadingMaterialFilter || isLoadingCategoryFilter;
  const isInitialCatalogLoad =
    (isLoadingProducts || isFetchingProducts) && realProducts.length === 0;

  useEffect(() => {
    setSearchQuery(searchQueryFromUrl);
    if (searchQueryFromUrl.trim()) {
      // resultsCount via ref para evitar TDZ (filteredProducts é declarado abaixo)
      trackSearch({
        searchTerm: searchQueryFromUrl,
        resultsCount: filteredProductsRef.current.length,
        filtersUsed: { sortBy },
      });
      updatePreferences({
        lastSearchTerm: searchQueryFromUrl,
        lastSearchSortBy: sortBy,
      });
    }
  }, [searchQueryFromUrl, trackSearch, sortBy, updatePreferences]);

  // BUG-SORT-01 FIX: Validar o sort param da URL antes de sincronizar com o state.
  // BUG-URL-01 FIX: Normalizar a URL — remover param default (?sort=newest) e
  // canonicalizar aliases (?sort=popularity → ?sort=best-seller-promo).
  useEffect(() => {
    const urlSort = searchParams.get('sort');
    const pendingLocalSort = pendingLocalSortRef.current;
    if (pendingLocalSort) {
      const urlMatchesPendingSort =
        pendingLocalSort === 'newest' ? !urlSort : validateSortOption(urlSort) === pendingLocalSort;

      if (!urlMatchesPendingSort) return;
      pendingLocalSortRef.current = null;
    }

    if (urlSort) {
      const validated = validateSortOption(urlSort);

      // Sincronizar state se o valor validado diferir do atual
      if (validated !== sortBy) {
        setSortByState(validated);
      }

      // Normalizar URL: remover sort=default ou substituir alias por canonical.
      // Cobre dois casos:
      //   1. ?sort=newest      → remover (é o default; param redundante)
      //   2. ?sort=popularity  → substituir por ?sort=best-seller-promo (canonical)
      const urlNeedsNormalization = validated === 'newest' || urlSort !== validated;
      if (urlNeedsNormalization) {
        const newParams = new URLSearchParams(window.location.search);
        if (validated === 'newest') {
          newParams.delete('sort');
        } else {
          newParams.set('sort', validated);
        }
        const newPath = `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`;
        navigate(newPath, { replace: true });
      }
    }
  }, [searchParams, sortBy, navigate]);

  // BUG-CS-06 FIX: Reset displayCount without startTransition wrapper.
  // Depends on debouncedServerSearch to avoid resetting on every keystroke.
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [filters, sortBy, debouncedSearch]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.colors.length) count += filters.colors.length;
    if (filters.colorGroups?.length) count += filters.colorGroups.length;
    if (filters.colorVariations?.length) count += filters.colorVariations.length;
    if (filters.colorNuances?.length) count += filters.colorNuances.length;
    if (filters.categories.length) count += filters.categories.length;
    if (filters.suppliers.length) count += filters.suppliers.length;
    if (filters.publicoAlvo.length) count += filters.publicoAlvo.length;
    if (filters.datasComemorativas.length) count += filters.datasComemorativas.length;
    if (filters.endomarketing.length) count += filters.endomarketing.length;
    if (filters.ramosAtividade?.length) count += filters.ramosAtividade.length;
    if (filters.segmentosAtividade?.length) count += filters.segmentosAtividade.length;
    if (filters.materialGroups?.length) count += filters.materialGroups.length;
    if (filters.materialTypes?.length) count += filters.materialTypes.length;
    if (filters.materiais.length) count += filters.materiais.length;
    // BUG-22 FIX: era < 500, deve ser < 9999 para contar filtro de preco corretamente.
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 9999) count += 1;
    if (filters.inStock) count += 1;
    if (filters.isKit) count += 1;
    if (filters.featured) count += 1;
    if (filters.gender?.length) count += filters.gender.length;
    return count;
  }, [filters]);

  const debouncedSearchQuery = debouncedSearch;
  const { results: fuzzySearchResults, hasSearch: hasFuzzySearch } = useProductFuzzySearch(
    realProducts,
    debouncedSearchQuery,
  );

  const filteredProducts = useCatalogFiltering({
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
    supplierSalesMap: supplierSalesMap as unknown as Map<string, number> | undefined,
  });

  // Mantém filteredProductsRef sincronizado (consumido por setSortBy e pelo
  // effect de busca via ref, ambos declarados acima desta linha).
  useEffect(() => {
    filteredProductsRef.current = filteredProducts;
  }, [filteredProducts]);

  // GAP-2 FIX (PR #689 review): snapshot dos produtos exibidos enquanto NÃO há
  // transição. Antes, o snapshot ficava [] para sempre e displayFilteredProducts
  // virava lista vazia durante transições de sort — flash de empty state.
  // Timing: o effect roda APÓS cada render estável (ref = última lista estável);
  // quando setIsTransitioning(true) dispara o render seguinte, o display lê o
  // ref congelado (effects deste render não escrevem pois isTransitioning=true).
  useEffect(() => {
    if (!isTransitioning) {
      lastNonTransitionedProductsRef.current = filteredProducts;
    }
  }, [isTransitioning, filteredProducts]);

  const displayFilteredProducts = isTransitioning
    ? lastNonTransitionedProductsRef.current
    : filteredProducts;

  const rawPaginatedProducts = useMemo(
    () => displayFilteredProducts.slice(0, displayCount),
    [displayFilteredProducts, displayCount],
  );

  const hasColorFilterActive =
    (filters.colorGroups?.length ?? 0) > 0 || (filters.colorVariations?.length ?? 0) > 0;
  const paginatedProductIds = useMemo(
    () => rawPaginatedProducts.map((p) => p.id),
    [rawPaginatedProducts],
  );
  const { data: catalogColorEnrichmentMap } = useColorEnrichment({
    productIds: paginatedProductIds,
    colorGroups: filters.colorGroups ?? [],
    colorVariations: filters.colorVariations ?? [],
  });

  const paginatedProducts = useMemo(() => {
    if (!catalogColorEnrichmentMap || catalogColorEnrichmentMap.size === 0 || !hasColorFilterActive)
      return rawPaginatedProducts;
    return rawPaginatedProducts.map((product) => {
      const enrichment = catalogColorEnrichmentMap.get(product.id);
      if (!enrichment) return product;
      return {
        ...product,
        ...(enrichment.image
          ? {
              og_image_url: enrichment.image,
              images: [
                enrichment.image,
                ...product.images.filter((img: string) => img !== enrichment.image),
              ],
            }
          : {}),
        stock: enrichment.stock,
        stockStatus: enrichment.stockStatus,
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
  }, [
    rawPaginatedProducts,
    catalogColorEnrichmentMap,
    hasColorFilterActive,
    filters.colorGroups,
    filters.colorVariations,
  ]);

  // BUG-SCROLL-01 FIX: chave estável derivada de sortBy + filters + debouncedSearch
  // + viewMode. Muda SOMENTE quando o conjunto de produtos muda qualitativamente
  // (filter/sort/search/viewMode), NUNCA quando displayCount aumenta via loadMore().
  // Passada ao VirtualizedProductGrid para rolar ao topo apenas nas mudanças certas.
  const scrollResetKey = useMemo(() => {
    // GAP-COLISÃO FIX: serializa tudo via JSON.stringify de um array. Concatenar
    // com '|' abria uma colisão teórica: um search contendo '|' poderia, em tese,
    // produzir a mesma string que outra combinação. Empacotar em array +
    // JSON.stringify escapa qualquer caractere especial (aspas, pipe, emoji) de
    // forma inequívoca. JSON.stringify só recomputa quando uma dep muda — custo mínimo.
    return JSON.stringify([sortBy, debouncedSearch, viewMode, filters]);
  }, [sortBy, debouncedSearch, viewMode, filters]);

  const hasActiveCatalogConstraints = useMemo(
    () => activeFiltersCount > 0 || searchQuery.trim().length > 0,
    [activeFiltersCount, searchQuery],
  );

  // FIX: Se estivermos em transição de sortBy, NÃO mostramos o skeleton global
  // que reseta o scroll e o layout. Mantemos o `displayFilteredProducts` (estável)
  // visível até o novo sort processar.
  const shouldShowCatalogSkeleton =
    !isTransitioning &&
    (isInitialCatalogLoad ||
      (isLoading && paginatedProducts.length === 0 && !hasActiveCatalogConstraints));
  const shouldShowEmptyState =
    !shouldShowCatalogSkeleton && paginatedProducts.length === 0 && !isFetchingNextPage;

  const hasMoreProducts = useMemo(() => {
    // BUG-CS-02: Se displayCount for menor que filteredProducts, temos mais localmente.
    // Se for maior ou igual, dependemos de hasNextPage no servidor.
    return filteredProducts.length > displayCount || !!hasNextPage;
  }, [filteredProducts.length, displayCount, hasNextPage]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || isFetchingNextPage) return;
    if (!hasMoreProducts) return;

    setIsLoadingMore(true);

    const nextDisplayCount = displayCount + ITEMS_PER_PAGE;
    const needsServerData = nextDisplayCount >= filteredProducts.length && hasNextPage;

    if (needsServerData) {
      fetchNextPage().finally(() => {
        setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
        setIsLoadingMore(false);
      });
    } else {
      // Virtual loading for local products
      setTimeout(() => {
        setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
        setIsLoadingMore(false);
      }, 50);
    }
  }, [
    isLoading,
    isLoadingMore,
    isFetchingNextPage,
    hasMoreProducts,
    displayCount,
    filteredProducts.length,
    hasNextPage,
    fetchNextPage,
  ]);
  // loadMoreRef: sentinel <div> que dispara loadMore() via IntersectionObserver
  // quando o usuário rola até o final da lista de produtos.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMoreProducts || isLoadingMore || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreProducts, isLoadingMore, isFetchingNextPage, loadMore]);

  const statBadges = useMemo(() => {
    const hasActiveFilters = activeFiltersCount > 0 || searchQuery.trim().length > 0;
    const seen = new Set<string>();
    const deduped = filteredProducts.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const productCount = hasActiveFilters ? deduped.length : totalEstimate || deduped.length;
    const localVariants = deduped.reduce((sum, p) => {
      const colorCount = p.colors?.filter((c) => (c as { name?: string }).name?.trim()).length ?? 0;
      const variationCount = !colorCount && p.variations?.length ? p.variations.length : 0;
      return sum + colorCount + variationCount;
    }, 0);
    const totalVariants = hasActiveFilters
      ? localVariants
      : (realStats?.totalVariants ?? localVariants);

    const uniqueCategoryIds = new Set(
      deduped
        .map((p) => p.category_id || (p.category?.id ? String(p.category.id) : ''))
        .filter((id) => id && id !== '0'),
    );
    const categoriesCount = hasActiveFilters
      ? uniqueCategoryIds.size
      : (realStats?.totalCategories ?? uniqueCategoryIds.size);

    const uniqueSuppliers = new Set(
      deduped
        .map((p) => p.supplier?.name?.trim().toLowerCase())
        .filter((n): n is string => !!n && n !== 'sem fornecedor'),
    );
    const suppliersCount = hasActiveFilters
      ? uniqueSuppliers.size
      : (realStats?.totalSuppliers ?? uniqueSuppliers.size);

    // BUG-CS-01 FIX: isFavorite is a *function* reference — always truthy in ternary condition.
    // The favoriteCount branch was never reached. Correct gate is hasActiveFilters.
    const contextualFavoriteCount = hasActiveFilters
      ? deduped.filter((p) => isFavorite(p.id)).length
      : favoriteCount;

    return [
      {
        id: 'products',
        label: 'Produtos Unicos',
        value: productCount,
        icon: React.createElement(Package, { className: 'h-4 w-4' }),
      },
      {
        id: 'variants',
        label: 'Variacoes',
        value: totalVariants,
        icon: React.createElement(Palette, { className: 'h-4 w-4' }),
      },
      {
        id: 'categories',
        label: 'Categorias',
        value: categoriesCount,
        icon: React.createElement(FolderTree, { className: 'h-4 w-4' }),
      },
      {
        id: 'suppliers',
        label: 'Fornecedores',
        value: suppliersCount,
        icon: React.createElement(Users, { className: 'h-4 w-4' }),
      },
      {
        id: 'favorites',
        label: 'Favoritos',
        value: contextualFavoriteCount,
        icon: React.createElement(Heart, { className: 'h-4 w-4' }),
      },
    ];
  }, [
    filteredProducts,
    favoriteCount,
    isFavorite,
    activeFiltersCount,
    searchQuery,
    totalEstimate,
    // BUG-STAT-01 FIX: hasNextPage removido — causava recalculo desnecessario a cada page fetch
    realStats,
  ]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSortBy('newest');
    setSearchQuery('');
    navigate('/', { replace: true });
  }, [navigate, setSortBy]);

  const handleViewProduct = useCallback(
    (product: Product) => {
      navigate(`/produto/${product.id}`);
    },
    [navigate],
  );

  const [shareProduct, setShareProduct] = useState<Product | null>(null);

  const handleShareProduct = useCallback((product: Product) => {
    setShareProduct(product);
  }, []);

  const handleFavoriteProduct = useCallback(
    (product: Product, e?: React.MouseEvent) => {
      const result = favQuickAdd.handleFavoriteClick(product as never, { shiftKey: e?.shiftKey });
      if (!result.resolved && result.reason === 'picker-needed') {
        const target = favQuickAdd.defaultList;
        if (target) {
          void favQuickAdd.addToList(target.id, product as never);
          toast({
            title: 'Adicionado aos Favoritos',
            description: `Salvo em "${target.name}". Use Shift+clique para confirmar a lista padrao sem confirmacao.`,
          });
        } else {
          toggleFavorite(product.id);
        }
      }
    },
    [favQuickAdd, toggleFavorite, toast],
  );

  // BUG-KBD-01 FIX: handleFavoriteProduct estava nas deps do keyboard useEffect.
  // Como depende de favQuickAdd/toggleFavorite/toast, era recriada com frequencia,
  // causando re-registro desnecessario do listener a cada render do catalogo.
  // Solucao: capturar a versao mais recente em ref sem adicionar deps instaveis.
  const handleFavoriteProductRef = useRef(handleFavoriteProduct);
  useEffect(() => {
    handleFavoriteProductRef.current = handleFavoriteProduct;
  }, [handleFavoriteProduct]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX: cleanup searchDebounceRef no unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);
  const handleSearch = useCallback(
    (query: string) => {
      setIsSearching(true);
      setSearchQuery(query);
      if (query) addToHistory(query);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => setIsSearching(false), 300);
    },
    [addToHistory],
  );

  // Keyboard Navigation Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea or if dialogs are open (heuristic)
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;
      if (document.querySelector('[role="dialog"]') || document.querySelector('[role="menu"]'))
        return;

      const currentIndex = paginatedProducts.findIndex((p) => p.id === activeProductId);

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < paginatedProducts.length - 1) {
            setActiveProductId(paginatedProducts[currentIndex + 1].id);
          }
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setActiveProductId(paginatedProducts[currentIndex - 1].id);
          } else if (currentIndex === -1 && paginatedProducts.length > 0) {
            setActiveProductId(paginatedProducts[0].id);
          }
          break;
        case 'Enter':
        case 'o':
          if (activeProductId) {
            e.preventDefault();
            navigate(`/produto/${activeProductId}`);
          }
          break;
        case 'f':
          if (activeProductId) {
            e.preventDefault();
            const product = paginatedProducts.find((p) => p.id === activeProductId);
            // BUG-KBD-01 FIX: usa ref em vez da funcao diretamente nas deps
            if (product) handleFavoriteProductRef.current(product);
          }
          break;
        case 'Escape':
          if (activeProductId) {
            e.preventDefault();
            setActiveProductId(null);
          }
          if (selectionMode) {
            setSelectionMode(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // BUG-KBD-01 FIX: handleFavoriteProduct removido das deps — era instavel.
    // handleFavoriteProductRef.current e sempre atual sem triggerar re-registro.
  }, [activeProductId, paginatedProducts, navigate, selectionMode]);

  return {
    filters,
    setFilters,
    viewMode,
    setViewMode,
    gridColumns,
    setGridColumns,
    sortBy,
    setSortBy,
    refetchCatalog,
    selectionMode,
    setSelectionMode,
    selectedCount,
    setSelectedCount,
    toggleSelectionMode,
    filterSheetOpen,
    setFilterSheetOpen,
    searchQuery,
    setSearchQuery,
    isSearching,
    displayCount,
    setDisplayCount,
    isLoadingMore,
    isInitialCatalogLoad,
    isLoading,
    isBackgroundFetching: isFetchingNextPage,
    paginatedProducts,
    filteredProducts,
    totalEstimate,
    loadMoreRef,
    statBadges,
    resetFilters,
    handleViewProduct,
    handleShareProduct,
    handleFavoriteProduct,
    handleSearch,
    isFavorite,
    toggleFavorite,
    isInCompare,
    toggleCompare,
    canAddMore,
    activeFiltersCount,
    hasActiveCatalogConstraints,
    shouldShowCatalogSkeleton,
    shouldShowEmptyState,
    shareProduct,
    setShareProduct,
    hasNextPage,
    activeProductId,
    setActiveProductId,
    suggestions,
    quickSuggestions,
    searchHistory: history,
    clearHistory,
    // Navigation & pagination
    navigate,
    isTransitioning,
    hasMoreProducts,
    ITEMS_PER_PAGE,
    loadMore,
    scrollResetKey,
  };
}
