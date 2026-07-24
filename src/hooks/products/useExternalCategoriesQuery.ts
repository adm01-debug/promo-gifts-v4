/**
 * Hook para buscar categorias do banco externo com React Query.
 * Migrated from supabase.functions.invoke('external-db-bridge') to dbInvoke
 * (2026-05-30) — uses REST native PostgREST path, zero Edge Function calls.
 */
import { useMemo } from 'react';
import { dbInvoke } from '@/lib/db/postgrest';
import { useQuery } from '@tanstack/react-query';
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

export const EXTERNAL_CATEGORIES_QUERY_KEY = ['external-categories'] as const;

async function fetchExternalCategories(): Promise<ExternalCategory[]> {
  const result = await dbInvoke<ExternalCategory>({
    table: 'categories',
    operation: 'select',
    filters: { is_active: true },
    limit: 1000,
    orderBy: { column: 'name', ascending: true },
  });
  return result.records || [];
}

export function useExternalCategoriesQuery() {
  return useQuery({
    queryKey: EXTERNAL_CATEGORIES_QUERY_KEY,
    queryFn: fetchExternalCategories,
    staleTime: CACHE_TIMES.STABLE,
    gcTime: GC_TIMES.TECNICAS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCategoryById(categoryId: string | undefined) {
  const { data: categories = [] } = useExternalCategoriesQuery();
  return useMemo(
    () => (categoryId ? (categories.find((cat) => cat.id === categoryId) ?? null) : null),
    [categoryId, categories],
  );
}

export function useCategoriesByIds(categoryIds: string[]) {
  const { data: categories = [] } = useExternalCategoriesQuery();
  return useMemo(() => {
    if (!categoryIds.length) return [];
    const idSet = new Set(categoryIds);
    return categories.filter((cat) => idSet.has(cat.id));
  }, [categoryIds, categories]);
}
