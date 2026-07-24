/**
 * useWordMagicStore — toggle global Word Magic
 *
 * Um único estado booleano: isGlobalAIMode
 *   false = catálogo mostra textos NATIVOS do fornecedor (padrão)
 *   true  = catálogo mostra textos melhorados por IA (quando disponíveis)
 *
 * Persiste em localStorage para manter preferência entre sessões.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WordMagicStore {
  isGlobalAIMode: boolean;
  toggleGlobalAIMode: () => void;
  setGlobalAIMode: (value: boolean) => void;
}

export const useWordMagicStore = create<WordMagicStore>()(
  persist(
    (set) => ({
      isGlobalAIMode: false,
      toggleGlobalAIMode: () => set((s) => ({ isGlobalAIMode: !s.isGlobalAIMode })),
      setGlobalAIMode: (value) => set({ isGlobalAIMode: value }),
    }),
    {
      name: 'word-magic-global-mode',
    },
  ),
);
