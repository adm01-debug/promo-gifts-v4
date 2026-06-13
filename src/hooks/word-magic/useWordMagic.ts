/**
 * useWordMagic — hook de produto para o modo global de IA
 *
 * Lê isGlobalAIMode do store e, se ativo, retorna os campos de IA
 * do produto. Caso contrário retorna os campos nativos.
 * Sem geração on-demand — textos vêm do banco (gerados pelo n8n).
 */
import { useWordMagicStore } from '@/stores/useWordMagicStore';
import type { Product } from '@/types/product-catalog';

interface WordMagicResult {
  displayName: string;
  displayDescription: string | null;
  displaySummary: string | null;
  isAIActive: boolean;      // modo global ON + produto tem IA
  hasEnrichment: boolean;   // produto tem texto IA no banco
}

export function useWordMagic(product: Product): WordMagicResult {
  const isGlobalAIMode = useWordMagicStore((s) => s.isGlobalAIMode);

  const hasEnrichment = Boolean(
    product.aiVersion && product.aiVersion > 0 && product.aiTitle,
  );

  const isAIActive = isGlobalAIMode && hasEnrichment;

  return {
    displayName:        isAIActive && product.aiTitle       ? product.aiTitle       : product.name,
    displayDescription: isAIActive && product.aiDescription ? product.aiDescription : (product.description ?? null),
    displaySummary:     isAIActive && product.aiSummary     ? product.aiSummary     : null,
    isAIActive,
    hasEnrichment,
  };
}
