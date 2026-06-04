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

export const useProductSelectionStore = create<ProductSelectionState & ProductSelectionActions>()(
  persist(
    (set, get) => ({
      selectedColors: {},

      setSelectedColor: (productId, colorName) => {
        set((state) => ({
          selectedColors: {
            ...state.selectedColors,
            [productId]: colorName,
          },
        }));
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
