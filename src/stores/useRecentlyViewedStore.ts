import { create } from 'zustand';

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
    if (!stored) return [];
    const raw = JSON.parse(stored);
    if (!Array.isArray(raw)) return [];
    // Validate each item has productId (filter out corrupted entries)
    return raw.filter(
      (item: unknown): item is RecentlyViewedItem =>
        typeof item === 'object' && item !== null && typeof (item as RecentlyViewedItem).productId === 'string',
    );
  } catch {
    return [];
  }
}

function saveToStorage(items: RecentlyViewedItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // silently fail
  }
}

// Debounce tracking to prevent duplicate rapid additions
let lastAddedId: string | null = null;
let lastAddedTimer: ReturnType<typeof setTimeout> | null = null;

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

/** Atomic selectors — use these in components to avoid unnecessary re-renders */
export const useRecentlyViewedItems = () => useRecentlyViewedStore((s) => s.items);
export const useRecentlyViewedCount = () => useRecentlyViewedStore((s) => s.itemCount);
