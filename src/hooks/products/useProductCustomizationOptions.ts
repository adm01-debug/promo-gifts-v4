/**
 * useProductCustomizationOptions — Hook para buscar opções de personalização
 *
 * Chama fn_get_product_customization_options via supabase.rpc() direto.
 * Em falha, classifica o erro (rede/RPC/vazio) e devolve mensagem amigável
 * em pt-BR para o componente exibir com botão "Tentar novamente".
 */

import { useQuery } from '@tanstack/react-query';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { adaptCustomizationOptions } from '@/lib/personalization/adapters';
import type { CustomizationOptionsResponse } from '@/types/customization';
import { logger } from '@/lib/logger';

export type TechniquesErrorKind = 'network' | 'rpc' | 'empty' | 'unknown';

export class TechniquesLoadError extends Error {
  readonly kind: TechniquesErrorKind;
  readonly originalMessage: string;
  constructor(kind: TechniquesErrorKind, friendly: string, originalMessage = '') {
    super(friendly);
    this.name = 'TechniquesLoadError';
    this.kind = kind;
    this.originalMessage = originalMessage;
  }
}

function classifyError(raw: unknown): TechniquesLoadError {
  const msg = raw instanceof Error ? raw.message : String(raw ?? '');
  const lower = msg.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up') ||
    lower.includes('aborterror')
  ) {
    return new TechniquesLoadError(
      'network',
      'Sem conexão com o servidor de técnicas. Verifique sua internet e tente novamente.',
      msg,
    );
  }
  if (
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  ) {
    return new TechniquesLoadError(
      'rpc',
      'O serviço de técnicas está temporariamente indisponível. Tente novamente em instantes.',
      msg,
    );
  }
  return new TechniquesLoadError(
    'unknown',
    'Não foi possível carregar as técnicas de personalização. Tente novamente.',
    msg,
  );
}

interface UseProductCustomizationOptionsArgs {
  productId: string | null;
  /** Contexto opcional para diagnóstico nos logs (id do orçamento, etapa, etc.). */
  diagnosticsContext?: {
    quoteId?: string | null;
    step?: string;
  };
}

export function useProductCustomizationOptions(
  productIdOrArgs: string | null | UseProductCustomizationOptionsArgs,
) {
  // Backward compatible: aceita string OU objeto com contexto
  const args: UseProductCustomizationOptionsArgs =
    typeof productIdOrArgs === 'object' && productIdOrArgs !== null
      ? productIdOrArgs
      : { productId: productIdOrArgs };

  const { productId, diagnosticsContext } = args;

  return useQuery({
    queryKey: ['product-customization-options', productId],
    queryFn: async (): Promise<CustomizationOptionsResponse | null> => {
      if (!productId) return null;
      try {
        const result = await invokeExternalRpc<Record<string, unknown>>(
          'fn_get_product_customization_options',
          { p_product_id: productId },
        );
        const adapted = adaptCustomizationOptions(result);
        if (!adapted || !adapted.locations?.length) {
          // Sem técnicas configuradas: NÃO lança — componente já trata locations.length===0.
          logger.info('[useProductCustomizationOptions] sem técnicas', {
            productId,
            ...diagnosticsContext,
          });
        }
        return adapted;
      } catch (err) {
        const classified = classifyError(err);
        logger.error('[useProductCustomizationOptions] falha ao carregar técnicas', {
          productId,
          kind: classified.kind,
          message: classified.originalMessage,
          ...diagnosticsContext,
        });
        throw classified;
      }
    },
    enabled: !!productId,
    staleTime: 30 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 5_000),
    refetchOnMount: true,
  });
}
