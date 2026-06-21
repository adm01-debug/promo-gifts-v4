import { useState, useMemo, useEffect } from 'react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import {
  useEnrichedFavoriteItems,
  useFavoriteLists,
  useFavoritesGlobalShortcuts,
  useFavoriteTrash,
  useLegacyFavoritesMigration,
} from '@/hooks/favorites';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useCatalogSelection } from '@/components/catalog/useCatalogSelection';
import type { Product } from '@/hooks/products';
import { useUndoStack } from '@/hooks/common';
import { getDefaultColumns, type ColumnCount } from '@/components/products/ColumnSelector';
import type { FavoritesSort } from '@/components/favorites/FavoritesSortBar';
import { toast } from 'sonner';

type ViewMode = 'grid' | 'list' | 'table';
const VIEW_MODE_KEY = 'favorites-view-mode';
const GRID_COLS_KEY = 'favorites-grid-cols';
const SELECTED_LIST_KEY = 'favorites-selected-list-id';
const SORT_KEY = 'favorites-sort';
const PRICE_DROP_FILTER_KEY = 'favorites-only-drops';

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'grid' || v === 'list' || v === 'table') return v as ViewMode;
  } catch {
    // Ignore localStorage errors
  }
  return 'grid';
}

function loadGridColumns(): ColumnCount {
  try {
    const v = localStorage.getItem(GRID_COLS_KEY);
    if (v) {
      const n = Number(v) as ColumnCount;
      if ([3, 4, 5, 6, 8].includes(n)) return n as ColumnCount;
    }
  } catch {
    // Ignore localStorage errors
  }
  return getDefaultColumns();
}

function loadSort(): FavoritesSort {
  try {
    const v = localStorage.getItem(SORT_KEY) as FavoritesSort | null;
    const allowed: FavoritesSort[] = [
      'recent',
      'oldest',
      'price-asc',
      'price-desc',
      'name-asc',
      'name-desc',
      'category',
    ];
    if (v && allowed.includes(v)) return v;
  } catch {
    // Ignore localStorage errors
  }
  return 'recent';
}

export function useFavoritesPageState() {
  // Global behavior hooks
  useFavoritesGlobalShortcuts();
  useUndoStack();
  useLegacyFavoritesMigration();

  const { favorites, clearFavorites, favoriteCount, toggleFavorite } = useFavoritesStore();
  const { lists, createList, updateList, deleteList, generateShareToken, revokeShareToken } =
    useFavoriteLists();
  const { items: trashItems } = useFavoriteTrash();
  const { getProductsByIds, products: _cacheSignal } = useProductsContext();

  // Basic UI State
  const [selectedListId, setSelectedListId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_LIST_KEY);
    } catch {
      return null;
    }
  });
  const [showTrash, setShowTrash] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [gridColumns, setGridColumns] = useState<ColumnCount>(loadGridColumns);
  const [sort, setSort] = useState<FavoritesSort>(loadSort);
  const [selectionMode, setSelectionMode] = useState(false);
  const [onlyPriceDrops, setOnlyPriceDrops] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PRICE_DROP_FILTER_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Derived logic
  const isRemoteListView = !!selectedListId && !showTrash;
  const {
    enriched,
    rawItems,
    removeItem,
    moveItem,
    updateItem: _updateItem,
  } = useEnrichedFavoriteItems(selectedListId);

  // Auto-select default list when none is selected and lists are loaded
  useEffect(() => {
    if (selectedListId === null && lists.length > 0) {
      const def = lists.find((l) => l.is_default) ?? lists[0];
      setSelectedListId(def.id);
    }
  }, [lists, selectedListId]);

  // Data persistence
  useEffect(() => {
    try {
      if (selectedListId) localStorage.setItem(SELECTED_LIST_KEY, selectedListId);
      else localStorage.removeItem(SELECTED_LIST_KEY);
    } catch {
      /* ignore */
    }
  }, [selectedListId]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);
  useEffect(() => {
    try {
      localStorage.setItem(GRID_COLS_KEY, String(gridColumns));
    } catch {
      /* ignore */
    }
  }, [gridColumns]);
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      /* ignore */
    }
  }, [sort]);
  useEffect(() => {
    try {
      localStorage.setItem(PRICE_DROP_FILTER_KEY, onlyPriceDrops ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [onlyPriceDrops]);

  // Maps and Products
  const variantMap = useMemo(() => {
    const map = new Map<string, unknown>();
    if (isRemoteListView) {
      enriched.forEach((e) => {
        if (e.item.variant_info) map.set(e.item.product_id, e.item.variant_info);
      });
    } else {
      favorites.forEach((f) => {
        if (f.variant) map.set(f.productId, f.variant);
      });
    }
    return map;
  }, [favorites, enriched, isRemoteListView]);

  const productsWithVariant = useMemo(() => {
    if (isRemoteListView) {
      return enriched
        .map((e) => e.productWithVariant)
        .filter((p): p is NonNullable<typeof p> => !!p);
    }
    const legacyProducts = getProductsByIds(favorites.map((f) => f.productId));
    return legacyProducts.map((product) => {
      const variant = variantMap.get(product.id) as { thumbnail?: string } | undefined;
      if (variant?.thumbnail) {
        return { ...product, images: [variant.thumbnail, ...(product.images || [])] };
      }
      return product;
    });
  }, [enriched, favorites, getProductsByIds, variantMap, isRemoteListView]);

  const enrichedMetaMap = useMemo(() => {
    const m = new Map<string, { priceDiffPct: number | null }>();
    if (isRemoteListView) {
      enriched.forEach((e) => m.set(e.item.product_id, { priceDiffPct: e.priceDiffPct }));
    }
    return m;
  }, [enriched, isRemoteListView]);

  const filteredProducts = useMemo(() => {
    let list = [...productsWithVariant];
    if (searchQuery.trim()) {
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = norm(searchQuery.trim());
      list = list.filter(
        (p) =>
          norm(p.name).includes(q) ||
          (p.sku && norm(p.sku).includes(q)) ||
          ((p as { brand?: string }).brand &&
            norm((p as { brand?: string }).brand ?? '').includes(q)),
      );
    }
    if (onlyPriceDrops && isRemoteListView) {
      list = list.filter((p) => {
        const meta = enrichedMetaMap.get(p.id);
        return (
          meta?.priceDiffPct !== null && meta?.priceDiffPct !== undefined && meta.priceDiffPct < -2
        );
      });
    }
    const sorted = [...list];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
      case 'price-desc':
        sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
        break;
      case 'category':
        sorted.sort((a, b) =>
          ((a as { category_name?: string }).category_name ?? '').localeCompare(
            (b as { category_name?: string }).category_name ?? '',
            'pt-BR',
          ),
        );
        break;
      case 'oldest':
        sorted.reverse();
        break;
      case 'recent':
      default:
        break;
    }
    return sorted;
  }, [productsWithVariant, searchQuery, sort, onlyPriceDrops, isRemoteListView, enrichedMetaMap]);

  // Bulk selection
  const selection = useCatalogSelection(filteredProducts as Product[], selectionMode);

  // Handlers
  const handleClearAll = () => {
    if (isRemoteListView) {
      toast.info('Use a lixeira para remover items individualmente');
      return;
    }
    clearFavorites();
    toast.success('Todos os favoritos foram removidos');
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) selection.clearSelection();
      return !prev;
    });
  };

  const handleToggleFavorite = (productId: string) => {
    if (isRemoteListView) {
      const item = rawItems.find((it) => it.product_id === productId);
      if (item) removeItem.mutate(item.id);
    } else {
      toggleFavorite(productId);
    }
  };

  return {
    state: {
      selectedListId,
      setSelectedListId,
      showTrash,
      setShowTrash,
      sidebarOpen,
      setSidebarOpen,
      presenting,
      setPresenting,
      ariaAnnouncement,
      setAriaAnnouncement,
      searchQuery,
      setSearchQuery,
      viewMode,
      setViewMode,
      gridColumns,
      setGridColumns,
      sort,
      setSort,
      selectionMode,
      setSelectionMode,
      onlyPriceDrops,
      setOnlyPriceDrops,
    },
    data: {
      lists,
      createList,
      updateList,
      deleteList,
      generateShareToken,
      revokeShareToken,
      trashItems,
      filteredProducts,
      selection,
      headerTotalCount: isRemoteListView ? rawItems.length : favoriteCount,
      isRemoteListView,
    },
    handlers: {
      handleClearAll,
      toggleSelectionMode,
      handleToggleFavorite,
      moveItem,
    },
  };
}
