import { create } from 'zustand';

interface SearchStore {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  voiceOverlayOpen: boolean;
  setVoiceOverlayOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  open: false,
  setOpen: (open) =>
    set((state) => ({
      open: typeof open === 'function' ? open(state.open) : open,
    })),
  voiceOverlayOpen: false,
  setVoiceOverlayOpen: (open) => set({ voiceOverlayOpen: open }),
}));
