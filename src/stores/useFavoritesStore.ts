import { create } from 'zustand';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'product-favorites';

export interface FavoriteVariantInfo {
  color_name?: string | null;
  color_hex?: string | null;
  size_code?: string | null;
  variant_id?: string | null;
  thumbnail?: string | null;
}

export interface FavoriteItem {
  productId: string;
  addedAt: string;
  variant?: FavoriteVariantInfo;
}

interface FavoritesState {
  favorites: FavoriteItem[];
  favoriteIds: Set<string>;
  isLoaded: boolean;
}

interface FavoritesActions {
  addFavorite: (productId: string, variant?: FavoriteVariantInfo) => void;
  removeFavorite: (productId: string) => void;
  toggleFavorite: (productId: string, variant?: FavoriteVariantInfo) => void;
  isFavorite: (productId: string) => boolean;
  clearFavorites: () => void;
  getFavoriteVariant: (productId: string) => FavoriteVariantInfo | undefined;
}

interface FavoritesStore extends FavoritesState, FavoritesActions {
  favoriteCount: number;
}

function loadFromStorage(): FavoriteItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Filter out corrupted entries missing the required productId field
    return parsed.filter(
      (item): item is FavoriteItem =>
        item !== null && typeof item === 'object' && typeof item.productId === 'string',
    );
  } catch (err) {
    logger.warn('[useFavoritesStore] Failed to load from localStorage', err);
    // Clear the corrupted entry so the next load starts fresh
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* quota full or private mode — ignore */
    }
    return [];
  }
}

function saveToStorage(items: FavoriteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    logger.warn('[useFavoritesStore] Failed to save to localStorage (quota exceeded?)', err);
  }
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => {
  const initial = loadFromStorage();
  return {
    favorites: initial,
    favoriteIds: new Set(initial.map((f) => f.productId)),
    favoriteCount: initial.length,
    isLoaded: true,

    addFavorite: (productId: string, variant?: FavoriteVariantInfo) => {
      const { favoriteIds, favorites } = get();
      if (favoriteIds.has(productId)) return;
      const next = [...favorites, { productId, addedAt: new Date().toISOString(), variant }];
      const nextIds = new Set(favoriteIds).add(productId);
      saveToStorage(next);
      set({ favorites: next, favoriteIds: nextIds, favoriteCount: next.length });
    },

    removeFavorite: (productId: string) => {
      const next = get().favorites.filter((f) => f.productId !== productId);
      const nextIds = new Set(get().favoriteIds);
      nextIds.delete(productId);
      saveToStorage(next);
      set({ favorites: next, favoriteIds: nextIds, favoriteCount: next.length });
    },

    toggleFavorite: (productId: string, variant?: FavoriteVariantInfo) => {
      const { favorites, favoriteIds } = get();
      const exists = favoriteIds.has(productId);
      const next = exists
        ? favorites.filter((f) => f.productId !== productId)
        : [...favorites, { productId, addedAt: new Date().toISOString(), variant }];
      const nextIds = new Set(favoriteIds);
      if (exists) nextIds.delete(productId);
      else nextIds.add(productId);
      saveToStorage(next);
      set({ favorites: next, favoriteIds: nextIds, favoriteCount: next.length });
    },

    isFavorite: (productId: string) => get().favoriteIds.has(productId),

    getFavoriteVariant: (productId: string) =>
      get().favorites.find((f) => f.productId === productId)?.variant,

    clearFavorites: () => {
      saveToStorage([]);
      set({ favorites: [], favoriteIds: new Set(), favoriteCount: 0 });
    },
  };
});
