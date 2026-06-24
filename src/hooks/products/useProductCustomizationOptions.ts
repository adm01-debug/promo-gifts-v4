/**
 * useProductCustomizationOptions — Hook para buscar opções de personalização
 *
 * Chama fn_get_product_customization_options via supabase.rpc() direto.
 *
 * CHANGELOG:
 *  - FIX-RQ-01: exposto isError/error/refetch para diagnóstico no componente
 *  - FIX-RQ-02: staleTime reduzido p/ 30s (dados semi-estáticos mas precisam
 *               refletir correções de banco sem exigir hard-refresh)
 *  - FIX-RQ-03: retry: 3 explícito — não depende do default global que
 *               pode bloquear em estado de erro por sessão inteira
 *  - FIX-RQ-04: refetchOnMount: true — garante dados frescos ao montar
 */

import { useQuery } from '@tanstack/react-query';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { adaptCustomizationOptions } from '@/lib/personalization/adapters';
import type { CustomizationOptionsResponse } from '@/types/customization';
import { logger } from '@/lib/logger';

export function useProductCustomizationOptions(productId: string | null) {
  return useQuery({
    queryKey: ['product-customization-options', productId],
    queryFn: async (): Promise<CustomizationOptionsResponse | null> => {
      if (!productId) return null;
      try {
        const result = await invokeExternalRpc<Record<string, unknown>>(
          'fn_get_product_customization_options',
          { p_product_id: productId },
        );
        return adaptCustomizationOptions(result);
      } catch (err) {
        // Logging estruturado para diagnóstico (request_id é injetado pelo logger).
        logger.error('[useProductCustomizationOptions] Falha ao carregar técnicas', {
          productId,
          message: err instanceof Error ? err.message : String(err),
        });
        // Re-throw com mensagem amigável; UI mostra fallback + botão "Tentar novamente".
        const friendly =
          'Não conseguimos carregar as técnicas de personalização agora. Tente novamente em instantes.';
        throw new Error(friendly);
      }
    },
    enabled: !!productId,
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5_000),
    refetchOnMount: true,
  });
}
