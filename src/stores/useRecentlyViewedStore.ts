import { create } from 'zustand';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'recently-viewed-products';
const MAX_ITEMS = 10;

export interface RecentlyViewedItem {
  productId: string;
  viewedAt: string;
}

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  isLoaded: boolean;
}

interface RecentlyViewedActions {
  addToRecentlyViewed: (productId: string) => void;
  removeFromRecentlyViewed: (productId: string) => void;
  clearRecentlyViewed: () => void;
}

interface RecentlyViewedStore extends RecentlyViewedState, RecentlyViewedActions {
  itemCount: number;
}

function loadFromStorage(): RecentlyViewedItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    logger.warn('[useRecentlyViewedStore] Failed to load from localStorage', err);
    return [];
  }
}

function saveToStorage(items: RecentlyViewedItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    logger.warn('[useRecentlyViewedStore] Failed to save to localStorage (quota exceeded?)', err);
  }
}

// Debounce tracking to prevent duplicate rapid additions (module-level — survives re-renders)
let lastAddedId: string | null = null;
let lastAddedTimer: ReturnType<typeof setTimeout> | null = null;

function clearDedupTimer() {
  if (lastAddedTimer !== null) {
    clearTimeout(lastAddedTimer);
    lastAddedTimer = null;
  }
  lastAddedId = null;
}

// Clear the dedup timer on page unload so it doesn't fire in HMR teardown.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearDedupTimer);
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>((set, get) => {
  const initial = loadFromStorage();
  return {
    items: initial,
    itemCount: initial.length,
    isLoaded: true,

    addToRecentlyViewed: (productId: string) => {
      if (lastAddedId === productId) return;
      lastAddedId = productId;
      if (lastAddedTimer) clearTimeout(lastAddedTimer);
      lastAddedTimer = setTimeout(() => {
        lastAddedId = null;
      }, 1000);

      const { items } = get();
      const filtered = items.filter((item) => item.productId !== productId);
      const next = [{ productId, viewedAt: new Date().toISOString() }, ...filtered].slice(
        0,
        MAX_ITEMS,
      );
      saveToStorage(next);
      set({ items: next, itemCount: next.length });
    },

    removeFromRecentlyViewed: (productId: string) => {
      const next = get().items.filter((item) => item.productId !== productId);
      saveToStorage(next);
      set({ items: next, itemCount: next.length });
    },

    clearRecentlyViewed: () => {
      saveToStorage([]);
      set({ items: [], itemCount: 0 });
    },
  };
});
