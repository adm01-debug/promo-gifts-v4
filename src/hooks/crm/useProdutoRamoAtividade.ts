/**
 * Consulta ramo_atividade via REST native (2026-05-30).
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';

export interface ProdutoRamoAtividade {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export function useProdutoRamoAtividade() {
  return useQuery({
    queryKey: ['produto-ramo-atividade'],
    queryFn: async (): Promise<ProdutoRamoAtividade[]> => {
      try {
        const result = await invokeExternalDb<ProdutoRamoAtividade>({
          table: 'ramo_atividade',
          operation: 'select',
          orderBy: { column: 'name', ascending: true },
          limit: 100,
        });
        return result.records || [];
      } catch (e) {
        logger.warn('[useProdutoRamoAtividade] Failed:', (e as Error).message);
        return [];
      }
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
