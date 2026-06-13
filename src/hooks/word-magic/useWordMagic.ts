/**
 * useWordMagic — Hook central do Word Magic.
 *
 * Responsabilidades:
 * 1. Pré-carregar o enriquecimento do produto (se já tiver ai_version > 0)
 * 2. Gerar on-demand ao clicar no botão (via Edge Function word-magic)
 * 3. Gerenciar estados: isActive, isGenerating, hasEnrichment
 * 4. Expor textos de exibição: displayName, displayDescription, displaySummary
 *
 * O store (useWordMagicStore) persiste entre re-renders mas NÃO entre sessões
 * (não usa localStorage — dados sensíveis de catálogo não devem ser persistidos).
 */

import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { Product } from '@/types/product-catalog';
import { useWordMagicStore, type WordMagicEnrichment } from '@/stores/useWordMagicStore';
import { invokeWordMagic } from '@/lib/word-magic-api';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface UseWordMagicReturn {
  /** Enriquecimento disponível (DB ou gerado nesta sessão) */
  enrichment: WordMagicEnrichment | undefined;
  /** true = usuário ativou Word Magic (vendo texto IA) */
  isActive: boolean;
  /** true = geração em andamento (mostra spinner) */
  isGenerating: boolean;
  /** true = produto tem conteúdo IA disponível */
  hasEnrichment: boolean;

  // Textos prontos para exibição — usar em vez de product.name / product.description
  displayName:        string;
  displayDescription: string | null;
  displaySummary:     string | null;

  /** Clique no botão Word Magic — gera se não tem, toggle se tem */
  handleWordMagicClick: (force?: boolean) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWordMagic(product: Product): UseWordMagicReturn {
  const {
    setEnrichment,
    setActive,
    setGenerating,
    isActive:      selectIsActive,
    isGenerating:  selectIsGenerating,
    hasEnrichment: selectHasEnrichment,
    getEnrichment,
    toggleActive,
  } = useWordMagicStore();

  const productId = product.id;

  // ── Pré-carregamento: se produto já tem AI no DB, hidratar o store ────────
  useEffect(() => {
    if (!productId) return;
    // Já temos no store desta sessão → skip
    if (selectHasEnrichment(productId)) return;
    // Produto tem conteúdo IA no DB → hidratar diretamente sem chamar Edge Function
    if ((product.aiVersion ?? 0) > 0 && product.aiTitle) {
      setEnrichment(productId, {
        ai_title:        product.aiTitle!,
        ai_description:  product.aiDescription ?? '',
        ai_summary:      product.aiSummary      ?? '',
        ai_version:      product.aiVersion!,
        ai_generated_at: product.aiGeneratedAt  ?? undefined,
        source:          'db',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // ── Selectors reativos ────────────────────────────────────────────────────
  const isActive      = selectIsActive(productId);
  const isGenerating  = selectIsGenerating(productId);
  const hasEnrichment = selectHasEnrichment(productId);
  const enrichment    = getEnrichment(productId);

  // ── Textos de exibição ────────────────────────────────────────────────────
  const displayName: string        = (isActive && enrichment?.ai_title)       ? enrichment.ai_title       : product.name;
  const displayDescription: string | null = (isActive && enrichment?.ai_description) ? enrichment.ai_description : (product.description ?? null);
  const displaySummary: string | null     = (isActive && enrichment?.ai_summary)     ? enrichment.ai_summary     : (product.shortDescription ?? null);

  // ── Handler do botão ─────────────────────────────────────────────────────
  const handleWordMagicClick = useCallback(
    async (force = false) => {
      // Já gerando → ignorar
      if (selectIsGenerating(productId)) return;

      // Tem enriquecimento E não está forçando → apenas toggle ativo/inativo
      if (selectHasEnrichment(productId) && !force) {
        toggleActive(productId);
        return;
      }

      // Gerar via Edge Function
      setGenerating(productId, true);
      setActive(productId, false); // desativar durante geração

      try {
        const result = await invokeWordMagic({
          productId,
          forceRegenerate: force,
        });

        setEnrichment(productId, result.enrichment);
        setActive(productId, true); // ativar automaticamente após geração

        const ms = result.generation_ms ?? result.total_ms;
        toast.success('✨ Word Magic aplicado!', {
          description: ms ? `Gerado em ${(ms / 1000).toFixed(1)}s` : undefined,
          duration: 3000,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tente novamente.';
        toast.error('Word Magic falhou', { description: msg, duration: 5000 });
      } finally {
        setGenerating(productId, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productId],
  );

  return {
    enrichment,
    isActive,
    isGenerating,
    hasEnrichment,
    displayName,
    displayDescription,
    displaySummary,
    handleWordMagicClick,
  };
}
