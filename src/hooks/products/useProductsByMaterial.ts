import { useQuery } from '@tanstack/react-query';
import { materialService } from '@/services/materialService';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';

export interface UseProductsByMaterialOptions {
  /** Slugs dos tipos de material selecionados (ex: "algodao", "poliester") */
  materialTypeSlugs?: string[];
  /** Slugs dos grupos de material selecionados (ex: "tecidos", "metais") */
  materialGroupSlugs?: string[];
  /** Se habilitado, faz a query */
  enabled?: boolean;
}

export interface UseProductsByMaterialReturn {
  /** Set de product IDs que possuem os materiais selecionados */
  productIds: Set<string>;
  /** Array de product IDs */
  productIdsArray: string[];
  /** Se está carregando */
  isLoading: boolean;
  /** Erro, se houver */
  error: Error | null;
  /** Se há filtro de material ativo */
  hasFilter: boolean;
  /** Refetch manual */
  refetch: () => void;
}

/**
 * Hook para buscar IDs de produtos que possuem os materiais selecionados.
 * Usa a tabela product_materials do banco externo.
 */
export function useProductsByMaterial(
  options: UseProductsByMaterialOptions = {},
): UseProductsByMaterialReturn {
  const { materialTypeSlugs = [], materialGroupSlugs = [], enabled = true } = options;

  // Só faz a query se há filtros ativos
  const hasFilter = materialTypeSlugs.length > 0 || materialGroupSlugs.length > 0;
  const shouldFetch = enabled && hasFilter;

  // Sort arrays for stable query keys — same filters in different order → same cache entry.
  const stableTypesSlugs = useMemo(() => [...materialTypeSlugs].sort(), [materialTypeSlugs]);
  const stableGroupSlugs = useMemo(() => [...materialGroupSlugs].sort(), [materialGroupSlugs]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products-by-materials', stableTypesSlugs, stableGroupSlugs],
    queryFn: async () => {
      try {
        const result = await materialService.getProductsByMaterials({
          materialTypeSlugs: materialTypeSlugs.length > 0 ? materialTypeSlugs : undefined,
          materialGroupSlugs: materialGroupSlugs.length > 0 ? materialGroupSlugs : undefined,
        });
        return result;
      } catch (err) {
        logger.error('[useProductsByMaterial] falha ao buscar produtos por material', {
          error: err,
          typeSlugs: stableTypesSlugs,
          groupSlugs: stableGroupSlugs,
        });
        throw err;
      }
    },
    enabled: shouldFetch,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  const productIds = useMemo(() => {
    return new Set(data?.productIds ?? []);
  }, [data?.productIds]);

  const productIdsArray = useMemo(() => {
    return data?.productIds ?? [];
  }, [data?.productIds]);

  return {
    productIds,
    productIdsArray,
    isLoading: shouldFetch ? isLoading : false,
    error: error as Error | null,
    hasFilter,
    refetch,
  };
}
