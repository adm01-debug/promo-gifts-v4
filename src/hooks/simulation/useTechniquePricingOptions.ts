/**
 * Technique pricing options for simulation pages.
 * SELECTs migrated to invokeExternalDb (2026-05-30).
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';

export interface TechniquePricingOption {
  id: string;
  nome?: string;
  codigo_curto?: string;
  ativo?: boolean;
  [key: string]: unknown;
}

export interface PriceTier {
  id: string;
  tabela_id?: string;
  faixa_min?: number;
  faixa_max?: number;
  preco?: number;
  [key: string]: unknown;
}

export function useTechniquePricingOptions(tableId?: string) {
  return useQuery({
    queryKey: ['technique-pricing-options', tableId ?? 'all'],
    queryFn: async (): Promise<TechniquePricingOption[]> => {
      try {
        const result = await invokeExternalDb<TechniquePricingOption>({
          table: 'tecnica_gravacao',
          operation: 'select',
          filters: { ativo: true },
          orderBy: { column: 'nome', ascending: true },
          limit: 200,
        });
        return result.records || [];
      } catch (e) {
        logger.warn('[useTechniquePricingOptions] Failed:', (e as Error).message);
        return [];
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: true,
  });
}

export function usePriceTiers(tableId?: string) {
  return useQuery({
    queryKey: ['price-tiers', tableId ?? 'none'],
    queryFn: async (): Promise<PriceTier[]> => {
      if (!tableId) return [];
      try {
        const result = await invokeExternalDb<PriceTier>({
          table: 'customization_price_tiers',
          operation: 'select',
          filters: { tabela_id: tableId },
          orderBy: { column: 'faixa_min', ascending: true },
          limit: 500,
        });
        return result.records || [];
      } catch (e) {
        logger.warn('[usePriceTiers] Failed:', (e as Error).message);
        return [];
      }
    },
    enabled: Boolean(tableId),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
