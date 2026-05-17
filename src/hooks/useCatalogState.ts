/**
 * useCatalogState — all catalog page state & logic extracted from Index.tsx
 */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useColorEnrichment } from '@/hooks/useColorEnrichment';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Heart, Users, Palette, FolderTree } from 'lucide-react';

import { defaultFilters, type FilterState } from '@/components/filters/FilterPanel';
import {
  getDefaultColumns,
  STORAGE_KEY as GRID_COLUMNS_KEY,
  type ColumnCount,
} from '@/components/products/ColumnSelector';
import { useProductsCatalog } from '@/hooks/useProductsLightweight';
import type { Product } from '@/hooks/useProducts';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useSearch } from '@/hooks/useSearch';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useFavoriteQuickAdd } from '@/hooks/useFavoriteQuickAdd';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useProductsByMaterial } from '@/hooks/useProductsByMaterial';
import { useProductFuzzySearch } from '@/hooks/useProductFuzzySearch';
import { useProductsByCategory } from '@/hooks/useProductsByCategory';
import { useDebounce } from '@/hooks/useDebounce';
import { useExternalCategoriesQuery } from '@/hooks/useExternalCategoriesQuery';
import { useCatalogRealStats } from '@/hooks/useCatalogRealStats';
import { useToast } from '@/hooks/use-toast';
import { usePromoSalesRanking } from '@/hooks/usePromoSalesRanking';
import { useSupplierSalesRanking } from '@/hooks/useSupplierSalesRanking';
import { useCatalogFiltering } from './useCatalogFiltering';

export type ViewMode = 'grid' | 'list' | 'table';
export type SortOption =
  | 'relevance'
  | 'name'
  | 'price-asc'
  | 'price-desc'
  | 'stock'
  | 'newest'
  | 'color-match'
  | 'best-seller-supplier'
  | 'best-seller-promo';

const VIEW_MODE_KEY = 'catalog-view-mode';

function getPersistedViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    if (saved === 'grid' || saved === 'list' || saved === 'table') return saved;
  } catch {
    /* empty */
  }
  return 'grid';
}

const ITEMS_PER_PAGE = 36;

export function useCatalogState() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isFavorite, toggleFavorite, favoriteCount } = useFavoritesStore();
  const favQuickAdd = useFavoriteQuickAdd();
  const { isInCompare, toggleCompare, canAddMore } = useComparisonStore();
  const { registerProducts } = useProductsContext();
  const { data: promoSalesMap } = usePromoSalesRanking();
  const { data: supplierSalesMap } = useSupplierSalesRanking();

  const searchQueryFromUrl = searchParams.get('search') || '';

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
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedCount(0);
      return !prev;
    });
  }, []);

  // Responsive clamp
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 640 && gridColumns > 1) {
        setGridColumnsState(1);
      } else if (w >= 640 && w < 768 && gridColumns > 2) {
        setGridColumnsState(2);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridColumns]);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchQueryFromUrl);
  const [isSearching, setIsSearching] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const debouncedServerSearch = useDebounce(searchQuery, 400);

  const {
    data: catalogData,
    isLoading: isLoadingProducts,
    isFetching: isFetchingProducts,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchCatalog,
  } = useProductsCatalog(debouncedServerSearch ? { search: debouncedServerSearch } : undefined);

  const realProducts = useMemo(() => {
    if (!catalogData?.pages) return [] as Product[];
    return catalogData.pages.flatMap((page) => page.products);
  }, [catalogData]);

  const totalEstimate = catalogData?.pages?.[0]?.totalEstimate ?? null;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => fetchNextPage());
      } else {
        setTimeout(() => fetchNextPage(), 1000);
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
    materialGroupSlugs: filters.materialGroups || [],
    materialTypeSlugs: filters.materialTypes || [],
  });

  const {
    productIds: categoryFilteredProductIds,
    hasFilter: hasCategoryFilter,
    isLoading: isLoadingCategoryFilter,
  } = useProductsByCategory({
    categoryIds: filters.categories?.map(String) || [],
    includeDescendants: true,
  });

  useExternalCategoriesQuery();
  const { data: realStats } = useCatalogRealStats();

  const isLoading = isLoadingProducts || isLoadingMaterialFilter || isLoadingCategoryFilter;
  const isInitialCatalogLoad =
    (isLoadingProducts || isFetchingProducts) && realProducts.length === 0;

  useEffect(() => {
    setSearchQuery(searchQueryFromUrl);
  }, [searchQueryFromUrl]);

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [filters, sortBy, searchQuery]);

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
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500) count += 1;
    if (filters.inStock) count += 1;
    if (filters.isKit) count += 1;
    if (filters.featured) count += 1;
    if (filters.gender?.length) count += filters.gender.length;
    return count;
  }, [filters]);

  const debouncedSearchQuery = useDebounce(searchQuery, 350);
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
    supplierSalesMap,
  });

  const rawPaginatedProducts = useMemo(
    () => filteredProducts.slice(0, displayCount),
    [filteredProducts, displayCount],
  );

  const hasColorFilterActive =
    (filters.colorGroups?.length || 0) > 0 || (filters.colorVariations?.length || 0) > 0;
  const paginatedProductIds = useMemo(
    () => rawPaginatedProducts.map((p) => p.id),
    [rawPaginatedProducts],
  );
  const { data: catalogColorEnrichmentMap } = useColorEnrichment({
    productIds: paginatedProductIds,
    colorGroups: filters.colorGroups || [],
    colorVariations: filters.colorVariations || [],
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

  const hasActiveCatalogConstraints = (activeFiltersCount > 0 || (searchQuery && searchQuery.trim().length > 0));
  const shouldShowCatalogSkeleton =
    isInitialCatalogLoad ||
    (isLoading && paginatedProducts.length === 0 && !hasActiveCatalogConstraints);
  const shouldShowEmptyState =
    !shouldShowCatalogSkeleton && paginatedProducts.length === 0 && !isFetchingNextPage;

  const hasMoreProducts = useMemo(() => {
    return paginatedProducts.length < filteredProducts.length || !!hasNextPage;
  }, [paginatedProducts, filteredProducts, hasNextPage]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (isUpdatingRef.current) return;
    if (isLoading || isLoadingMore || isFetchingNextPage) return;
    if (!hasMoreProducts) return;

    isUpdatingRef.current = true;
    setIsLoadingMore(true);

    const nextDisplayCount = displayCount + ITEMS_PER_PAGE;
    const needsServerData = nextDisplayCount >= filteredProducts.length && hasNextPage;

    if (needsServerData) {
      fetchNextPage().finally(() => {
        setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
        setIsLoadingMore(false);
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 100);
      });
    } else {
      setTimeout(() => {
        setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
        setIsLoadingMore(false);
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 100);
      }, 150);
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

  useEffect(() => {
    if (isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreProducts && !isLoadingMore && !isUpdatingRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' },
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => {
      observerRef.current?.disconnect();
    };
  }, [isLoading, hasMoreProducts, isLoadingMore, loadMore]);

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
      const colorCount =
        p.colors?.filter((c: Record<string, string>) => c.name?.trim()).length || 0;
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

    const contextualFavoriteCount = isFavorite
      ? deduped.filter((p) => isFavorite(p.id)).length
      : favoriteCount;

    return [
      {
        id: 'products',
        label: 'Produtos Únicos',
        value: productCount,
        icon: React.createElement(Package, { className: 'h-4 w-4' }),
      },
      {
        id: 'variants',
        label: 'Variações',
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
    hasNextPage,
    realStats,
  ]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSortBy('name');
    setSearchQuery('');
    navigate('/', { replace: true });
  }, [navigate]);

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
      const result = favQuickAdd.handleFavoriteClick(product, { shiftKey: e?.shiftKey });
      if (!result.resolved && result.reason === 'picker-needed') {
        const target = favQuickAdd.defaultList;
        if (target) {
          void favQuickAdd.addToList(target.id, product);
          toast({
            title: 'Adicionado aos Favoritos',
            description: `Salvo em "${target.name}". Use Shift+clique para confirmar a lista padrão sem confirmação.`,
          });
        } else {
          toggleFavorite(product.id);
        }
      }
    },
    [favQuickAdd, toggleFavorite, toast],
  );

  const handleSearch = useCallback(
    (query: string) => {
      setIsSearching(true);
      setSearchQuery(query);
      if (query) addToHistory(query);
      setTimeout(() => setIsSearching(false), 300);
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
            if (product) handleFavoriteProduct(product);
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
  }, [activeProductId, paginatedProducts, navigate, handleFavoriteProduct, selectionMode]);

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
  };
}
