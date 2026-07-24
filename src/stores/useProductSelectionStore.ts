import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProductSelectionState {
  // Map of productId -> colorName
  selectedColors: Record<string, string>;
}

interface ProductSelectionActions {
  setSelectedColor: (productId: string, colorName: string) => void;
  getSelectedColor: (productId: string) => string | undefined;
  clearSelections: () => void;
}

export const useProductSelectionStore = create<ProductSelectionActions & ProductSelectionState>()(
  persist(
    (set, get) => ({
      selectedColors: {},

      setSelectedColor: (productId, colorName) => {
        set((state) => {
          const next = { ...state.selectedColors, [productId]: colorName };
          // FIX: cap a 200 entradas para não crescer indefinidamente no localStorage.
          // Remove as entradas mais antigas (primeiras inseridas) quando o limite é atingido.
          const keys = Object.keys(next);
          if (keys.length > 200) {
            const excess = keys.slice(0, keys.length - 200);
            for (const k of excess) delete next[k];
          }
          return { selectedColors: next };
        });
      },

      getSelectedColor: (productId) => {
        return get().selectedColors[productId];
      },

      clearSelections: () => {
        set({ selectedColors: {} });
      },
    }),
    {
      name: 'product-selection-storage',
    },
  ),
);
