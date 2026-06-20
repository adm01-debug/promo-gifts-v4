import { create } from 'zustand';

const STORAGE_KEY = 'product-comparison';
const MAX_COMPARE_ITEMS = 4;

export interface CompareVariantInfo {
  color_name?: string | null;
  color_hex?: string | null;
  size_code?: string | null;
  variant_id?: string | null;
  thumbnail?: string | null;
}

export interface CompareItem {
  productId: string;
  variant?: CompareVariantInfo;
}

/** Composite key: allows same product with different variants */
function itemKey(productId: string, variant?: CompareVariantInfo): string {
  return variant?.variant_id ? `${productId}::${variant.variant_id}` : productId;
}

function itemKeyFromItem(item: CompareItem): string {
  return itemKey(item.productId, item.variant);
}

interface ComparisonState {
  compareIds: string[];
  compareItems: CompareItem[];
  isLoaded: boolean;
}

interface ComparisonActions {
  addToCompare: (productId: string, variant?: CompareVariantInfo) => boolean;
  removeFromCompare: (productId: string, variantId?: string | null) => void;
  removeByIndex: (index: number) => void;
  toggleCompare: (
    productId: string,
    variant?: CompareVariantInfo,
  ) => { added: boolean; isFull: boolean };
  isInCompare: (productId: string, variantId?: string | null) => boolean;
  clearCompare: () => void;
  getCompareVariant: (productId: string) => CompareVariantInfo | undefined;
}

interface ComparisonStore extends ComparisonState, ComparisonActions {
  compareCount: number;
  maxItems: number;
  canAddMore: boolean;
}

function loadFromStorage(): CompareItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Corrupted/legacy non-array payload (e.g. `{}`) would crash at store init
    // when `.map` runs over it — fall back to empty instead of white-screening.
    if (!Array.isArray(parsed)) return [];
    // Migrate old format (string[]) to new format (CompareItem[])
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed.map((id: string) => ({ productId: id }));
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(items: CompareItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // silently fail
  }
}

function applyState(next: CompareItem[]) {
  return {
    compareItems: next,
    compareIds: next.map((i) => i.productId),
    compareCount: next.length,
    canAddMore: next.length < MAX_COMPARE_ITEMS,
  };
}

export const useComparisonStore = create<ComparisonStore>((set, get) => {
  const initial = loadFromStorage();
  return {
    ...applyState(initial),
    isLoaded: true,
    maxItems: MAX_COMPARE_ITEMS,

    addToCompare: (productId: string, variant?: CompareVariantInfo) => {
      const { compareItems } = get();
      const key = itemKey(productId, variant);
      if (
        compareItems.some((i) => itemKeyFromItem(i) === key) ||
        compareItems.length >= MAX_COMPARE_ITEMS
      ) {
        return false;
      }
      const next = [...compareItems, { productId, variant }];
      saveToStorage(next);
      set(applyState(next));
      return true;
    },

    removeFromCompare: (productId: string, variantId?: string | null) => {
      const items = get().compareItems;
      let next: CompareItem[];
      if (variantId) {
        const key = `${productId}::${variantId}`;
        next = items.filter((i) => itemKeyFromItem(i) !== key);
      } else {
        const idx = items.findIndex((i) => i.productId === productId);
        if (idx < 0) return;
        next = [...items];
        next.splice(idx, 1);
      }
      saveToStorage(next);
      set(applyState(next));
    },

    removeByIndex: (index: number) => {
      const items = [...get().compareItems];
      if (index >= 0 && index < items.length) {
        items.splice(index, 1);
        saveToStorage(items);
        set(applyState(items));
      }
    },

    toggleCompare: (productId: string, variant?: CompareVariantInfo) => {
      const { compareItems } = get();
      const key = itemKey(productId, variant);
      // If no variant provided, match by productId only (first occurrence)
      const existingIdx = variant
        ? compareItems.findIndex((i) => itemKeyFromItem(i) === key)
        : compareItems.findIndex((i) => i.productId === productId);

      if (existingIdx >= 0) {
        const next = compareItems.filter((_, idx) => idx !== existingIdx);
        saveToStorage(next);
        set(applyState(next));
        return { added: false, isFull: false };
      }
      if (compareItems.length >= MAX_COMPARE_ITEMS) {
        return { added: false, isFull: true };
      }
      const next = [...compareItems, { productId, variant }];
      saveToStorage(next);
      set(applyState(next));
      return { added: true, isFull: false };
    },

    isInCompare: (productId: string, variantId?: string | null) => {
      const items = get().compareItems;
      if (variantId) {
        const key = `${productId}::${variantId}`;
        return items.some((i) => itemKeyFromItem(i) === key);
      }
      return items.some((i) => i.productId === productId);
    },

    getCompareVariant: (productId: string) =>
      get().compareItems.find((i) => i.productId === productId)?.variant,

    clearCompare: () => {
      saveToStorage([]);
      set(applyState([]));
    },
  };
});
