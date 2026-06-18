/**
 * Hook para ranking de vendas por fornecedor (dados reais do BD externo).
 * Consome mv_product_intelligence via external-db-bridge para obter
 * turnover_score e avg_depletion_7d de todos os produtos.
 * Cache de 10 minutos — dados de MV não mudam em tempo real.
 */
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface ProductIntelligenceRanking {
  product_id: string;
  turnover_score: number;
  // FIX: nomes reais das colunas na MV são avg_depletion_*, não avg_velocity_*.
  // As colunas avg_velocity_* não existem → mapeamento antigo retornava sempre 0.
  avg_depletion_7d: number;
  avg_depletion_30d: number;
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
        // FIX 2026-06-18 (catalog-audit): limit 5000 truncava a MV (7.243 linhas),
        // deixando ~2.243 produtos SEM turnover_score no sort client-side
        // 'best-seller-supplier' (ranqueados como 0 → afundavam para o fim da lista).
        // Elevado para 20000 (margem de crescimento). O custo extra é desprezível:
        // são ~6 colunas numéricas por linha e o resultado fica em cache por 10 min.
        const result = await dbInvoke<ProductIntelligenceRanking>({
          table: 'mv_product_intelligence',
          operation: 'select',
          select: 'product_id, turnover_score, avg_depletion_7d, avg_depletion_30d, abc_classification, total_depleted_30d',
          limit: 20000,
        });

        const map = new Map<string, SupplierSalesEntry>();
        for (const row of result.records) {
          if (!row.product_id) continue;
          map.set(row.product_id, {
            turnoverScore: row.turnover_score || 0,
            // FIX: ler avg_depletion_7d/30d (colunas reais da MV).
            velocity7d: row.avg_depletion_7d || 0,
            velocity30d: row.avg_depletion_30d || 0,
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
