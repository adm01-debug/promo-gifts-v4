/**
 * useCustomizationPrice — Hook para calcular preço de gravação
 *
 * Chama fn_get_customization_price via external-db-bridge.
 * Formato de resposta v6 (flat, conforme briefing 12/02/2026).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { invokeExternalRpc } from '@/lib/external-rpc';
import { validateRpcPayload } from '@/lib/personalization/rpc-validator';
import { PRICE_CONTRACT } from '@/lib/personalization/rpc-contracts';
import type { CustomizationPriceResponseV6 } from '@/types/customization';

export interface CalculatePriceParamsV6 {
  areaId: string; // technique_id from fn_get_product_customization_options
  quantidade: number;
  numCores?: number;
  larguraCm?: number | null;
  alturaCm?: number | null;
}

export function useCustomizationPriceCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePrice = useCallback(
    async (params: CalculatePriceParamsV6): Promise<CustomizationPriceResponseV6 | null> => {
      setLoading(true);
      setError(null);

      try {
        const rpcParams: Record<string, unknown> = {
          p_area_id: params.areaId,
          p_quantidade: params.quantidade,
          p_num_cores: params.numCores ?? 1,
        };

        if (typeof params.larguraCm === 'number' && params.larguraCm > 0) {
          rpcParams.p_largura_cm = params.larguraCm;
        }
        if (typeof params.alturaCm === 'number' && params.alturaCm > 0) {
          rpcParams.p_altura_cm = params.alturaCm;
        }

        const result = await invokeExternalRpc<CustomizationPriceResponseV6>(
          'fn_get_customization_price',
          rpcParams,
        );

        setLoading(false);
        if (!result?.success) {
          setError(result?.error || 'Erro no cálculo de preço');
          return null;
        }
        validateRpcPayload(PRICE_CONTRACT, result as unknown as Record<string, unknown>);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao calcular preço';
        setError(message);
        setLoading(false);
        return null;
      }
    },
    [],
  );

  return { calculatePrice, loading, error };
}

/**
 * Hook reativo que recalcula o preço automaticamente com debounce.
 */
export function useCustomizationPriceReactive(
  techniqueId: string | null,
  quantidade: number,
  numCores = 1,
  larguraCm?: number | null,
  alturaCm?: number | null,
  usaDimensao = false,
) {
  const [price, setPrice] = useState<CustomizationPriceResponseV6 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!techniqueId || quantidade <= 0) {
      setPrice(null);
      return;
    }

    // If dimensions are required but not provided, don't calculate
    if (usaDimensao && (!larguraCm || larguraCm <= 0 || !alturaCm || alturaCm <= 0)) {
      setPrice(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const rpcParams: Record<string, unknown> = {
          p_area_id: techniqueId,
          p_quantidade: quantidade,
          p_num_cores: numCores,
        };

        if (usaDimensao && larguraCm && alturaCm) {
          rpcParams.p_largura_cm = larguraCm;
          rpcParams.p_altura_cm = alturaCm;
        }

        const result = await invokeExternalRpc<CustomizationPriceResponseV6>(
          'fn_get_customization_price',
          rpcParams,
        );

        if (result?.success) {
          validateRpcPayload(PRICE_CONTRACT, result as unknown as Record<string, unknown>);
          setPrice(result);
        } else {
          setError(result?.error || 'Erro no cálculo');
          setPrice(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao calcular preço');
        setPrice(null);
      } finally {
        setLoading(false);
      }
    }, 500); // debounce 500ms

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [techniqueId, quantidade, numCores, larguraCm, alturaCm, usaDimensao]);

  return { price, loading, error };
}
