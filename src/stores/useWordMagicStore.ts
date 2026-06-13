import { create } from 'zustand';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface WordMagicEnrichment {
  ai_title: string;
  ai_description: string;
  ai_summary: string;
  ai_version: number;
  ai_generated_at?: string;
  /** 'db' = veio do produto (já estava no DB), 'generated' = gerado agora */
  source: 'db' | 'cache' | 'generated';
}

interface WordMagicState {
  /** Cache client-side: productId → enriquecimento IA */
  enrichments: Record<string, WordMagicEnrichment>;
  /** Set de productIds com Word Magic ATIVO (mostrando texto IA) */
  activeIds: Set<string>;
  /** Set de productIds com geração em andamento */
  generatingIds: Set<string>;
}

interface WordMagicActions {
  setEnrichment: (productId: string, enrichment: WordMagicEnrichment) => void;
  toggleActive: (productId: string) => void;
  setActive: (productId: string, active: boolean) => void;
  setGenerating: (productId: string, generating: boolean) => void;
  isActive: (productId: string) => boolean;
  isGenerating: (productId: string) => boolean;
  hasEnrichment: (productId: string) => boolean;
  getEnrichment: (productId: string) => WordMagicEnrichment | undefined;
  /** Desativa Word Magic em TODOS os produtos (ex: ao sair do catálogo) */
  clearAllActive: () => void;
}

type WordMagicStore = WordMagicState & WordMagicActions;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWordMagicStore = create<WordMagicStore>((set, get) => ({
  enrichments:   {},
  activeIds:     new Set<string>(),
  generatingIds: new Set<string>(),

  setEnrichment: (productId, enrichment) => {
    set((s) => ({ enrichments: { ...s.enrichments, [productId]: enrichment } }));
  },

  toggleActive: (productId) => {
    set((s) => {
      const next = new Set(s.activeIds);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return { activeIds: next };
    });
  },

  setActive: (productId, active) => {
    set((s) => {
      const next = new Set(s.activeIds);
      active ? next.add(productId) : next.delete(productId);
      return { activeIds: next };
    });
  },

  setGenerating: (productId, generating) => {
    set((s) => {
      const next = new Set(s.generatingIds);
      generating ? next.add(productId) : next.delete(productId);
      return { generatingIds: next };
    });
  },

  isActive:      (productId) => get().activeIds.has(productId),
  isGenerating:  (productId) => get().generatingIds.has(productId),
  hasEnrichment: (productId) => productId in get().enrichments,
  getEnrichment: (productId) => get().enrichments[productId],

  clearAllActive: () => set({ activeIds: new Set<string>() }),
}));
