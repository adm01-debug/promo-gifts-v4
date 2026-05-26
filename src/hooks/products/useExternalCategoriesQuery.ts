/**
 * Hook para buscar categorias do banco externo com React Query
 *
 * Usa cache persistente para evitar re-fetches em remontagens
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE_TIMES, GC_TIMES } from '@/lib/query-config';

export interface ExternalCategory {
  id: string;
  bitrix_id?: string;
  name: string;
  slug?: string;
  description?: string;
  parent_id?: string | null;
  level?: number;
  position?: number;
  image_url?: string;
  is_active?: boolean;
  created_at?: string;
  products_count?: number;
}

interface QueryResult {
  records: ExternalCategory[];
  count: number | null;
}

// Query key para invalidação
export const EXTERNAL_CATEGORIES_QUERY_KEY = ['external-categories'] as const;

/**
 * Busca todas as categorias ativas do banco externo
 */
async function fetchExternalCategories(): Promise<ExternalCategory[]> {
  const { data, error } = await supabase.functions.invoke('external-db-bridge', {
    body: {
      table: 'categories',
      operation: 'select',
      filters: { is_active: true },
      limit: 1000,
      orderBy: { column: 'name', ascending: true },
      countMode: 'none',
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.success) {
    throw new Error(data.error || 'Erro ao buscar categorias');
  }

  const result = data.data as QueryResult;
  return result.records || [];
}

/**
 * Hook principal - usa React Query para cache persistente
 */
export function useExternalCategoriesQuery() {
  return useQuery({
    queryKey: EXTERNAL_CATEGORIES_QUERY_KEY,
    queryFn: fetchExternalCategories,
    staleTime: CACHE_TIMES.STABLE, // 10 minutos - categorias raramente mudam
    gcTime: GC_TIMES.TECNICAS, // 30 minutos no garbage collector
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook auxiliar para buscar uma categoria por ID
 */
export function useCategoryById(categoryId: string | undefined) {
  const { data: categories = [] } = useExternalCategoriesQuery();

  if (!categoryId) return null;
  return categories.find((cat) => cat.id === categoryId) || null;
}

/**
 * Hook auxiliar para buscar categorias por IDs
 */
export function useCategoriesByIds(categoryIds: string[]) {
  const { data: categories = [] } = useExternalCategoriesQuery();

  if (!categoryIds.length) return [];
  return categories.filter((cat) => categoryIds.includes(cat.id));
}
