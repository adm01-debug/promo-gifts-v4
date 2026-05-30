/**
 * Hook para buscar arvore de categorias do banco externo.
 * Migrated to invokeExternalDb (2026-05-30).
 */
import { useQuery } from '@tanstack/react-query';
import { invokeExternalDb } from '@/lib/external-db';
import { logger } from '@/lib/logger';

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug?: string;
  parent_id?: string | null;
  level?: number;
  position?: number;
  children_count?: number;
  products_count?: number;
  image_url?: string;
  is_active?: boolean;
}

export function useCategoriesTree(parentId?: string | null) {
  return useQuery({
    queryKey: ['categories-tree', parentId ?? 'root'],
    queryFn: async (): Promise<CategoryTreeNode[]> => {
      try {
        const filters: Record<string, unknown> = { is_active: true };
        if (parentId) filters.parent_id = parentId;
        else filters.parent_id = 'is.null';

        const result = await invokeExternalDb<CategoryTreeNode>({
          table: 'categories',
          operation: 'select',
          filters,
          orderBy: { column: 'name', ascending: true },
          limit: 500,
        });
        return result.records || [];
      } catch (e) {
        logger.warn('[useCategoriesTree] Failed:', (e as Error).message);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
