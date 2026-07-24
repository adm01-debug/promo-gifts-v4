/**
 * useProductEngravingOptions
 *
 * Hook read-only para listar os LOCAIS e TÉCNICAS de gravação de um produto
 * diretamente na página de detalhe (PDP). Reaproveita a RPC já existente
 * `fn_get_product_customization_options` — a MESMA consumida pelo Simulador —
 * garantindo paridade de dados e fonte única de verdade.
 *
 * A RPC foi auditada (2026-06-21) e retorna os locais corretamente tanto sob
 * `service_role` quanto sob `anon` (papel do PostgREST). Erros de rede/timeout
 * resultam em retorno vazio para nunca quebrar a renderização da PDP.
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalRpc } from '@/lib/external-rpc';
import type { CustomizationOptionsResponse, GravacaoLocation } from '@/types/customization';
import { logger } from '@/lib/logger';

export function useProductEngravingOptions(productId: string | undefined) {
  return useQuery<GravacaoLocation[]>({
    queryKey: ['product-engraving-options-v6', productId],
    queryFn: async (): Promise<GravacaoLocation[]> => {
      if (!productId) return [];
      try {
        const result = await invokeExternalRpc<CustomizationOptionsResponse>(
          'fn_get_product_customization_options',
          { p_product_id: productId },
        );
        return result?.locations ?? [];
      } catch (err) {
        logger.warn('[useProductEngravingOptions] Falha ao buscar locais de gravação:', err);
        return [];
      }
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000,
  });
}
