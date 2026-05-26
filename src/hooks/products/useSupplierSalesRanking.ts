/**
 * Hook para ranking de vendas por fornecedor (dados reais do BD externo).
 * Consome mv_product_intelligence via external-db-bridge para obter
 * turnover_score e avg_velocity_7d de todos os produtos.
 * Cache de 10 minutos — dados de MV não mudam em tempo real.
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';

interface ProductIntelligenceRanking {
  product_id: string;
  turnover_score: number;
  avg_velocity_7d: number;
  avg_velocity_30d: number;
  abc_classification: string;
  total_depleted_30d: number;
}

export interface SupplierSalesEntry {
  turnoverScore: number;
  velocity7d: number;
  velocity30d: number;
  abcClass: string;
  depleted30d: number;
}

/**
 * Fetches supplier sales ranking from external DB (mv_product_intelligence).
 * Returns a Map<productId, SupplierSalesEntry> for use in sorting.
 */
export function useSupplierSalesRanking() {
  return useQuery({
    queryKey: ['supplier-sales-ranking'],
    queryFn: async (): Promise<Map<string, SupplierSalesEntry>> => {
      try {
        const result = await invokeExternalDb<ProductIntelligenceRanking>({
          table: 'mv_product_intelligence',
          operation: 'select',
          select: '*',
          limit: 5000,
        });

        const map = new Map<string, SupplierSalesEntry>();
        for (const row of result.records) {
          if (!row.product_id) continue;
          map.set(row.product_id, {
            turnoverScore: row.turnover_score || 0,
            velocity7d: row.avg_velocity_7d || 0,
            velocity30d: row.avg_velocity_30d || 0,
            abcClass: row.abc_classification || 'C',
            depleted30d: row.total_depleted_30d || 0,
          });
        }

        logger.info(
          `[SupplierSalesRanking] Loaded ${map.size} products from mv_product_intelligence`,
        );
        return map;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        // Graceful fallback if MV not populated
        if (
          msg.includes('not been populated') ||
          msg.includes('não mapeada') ||
          msg.includes('does not exist')
        ) {
          logger.warn('[SupplierSalesRanking] MV not populated yet, returning empty map');
          return new Map();
        }
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 min cache
    retry: (failureCount, error: unknown) => {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('not been populated') || msg.includes('does not exist')) return false;
      return failureCount < 2;
    },
  });
}
