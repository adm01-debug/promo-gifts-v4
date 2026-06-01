import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProductsByCategoryOptions {
  categoryIds: string[];
  includeDescendants?: boolean;
  enabled?: boolean;
}

interface UseProductsByCategoryResult {
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
  error: string | null;
  categoriesCount: number;
  source: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para buscar IDs de produtos vinculados a categorias via tabela relacional
 * Usa a tabela product_category_assignments (ou fallbacks)
 */
export function useProductsByCategory({
  categoryIds,
  includeDescendants = true,
  enabled = true,
}: UseProductsByCategoryOptions): UseProductsByCategoryResult {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [source, setSource] = useState<string | null>(null);

  // CRITICAL: Estabilizar referência do array para evitar loops infinitos
  const categoryIdsKey = useMemo(() => [...categoryIds].sort().join(','), [categoryIds]);

  // Ref para evitar chamadas duplicadas
  const lastFetchedKey = useRef<string>('');
  const isFetchingRef = useRef(false);

  // Verificar se há filtro ativo
  const hasFilter = useMemo(() => {
    return categoryIds.length > 0;
  }, [categoryIds.length]);

  const fetchProductIds = useCallback(async () => {
    // Evitar chamadas duplicadas
    if (isFetchingRef.current) return;
    if (lastFetchedKey.current === categoryIdsKey && productIds.size > 0) return;

    if (!hasFilter || !enabled) {
      setProductIds(new Set());
      setCategoriesCount(0);
      setSource(null);
      lastFetchedKey.current = '';
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('categories-api', {
        body: {
          action: 'products_by_categories',
          categoryIds,
          includeDescendants,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar produtos por categoria');
      }

      setProductIds(new Set(data.productIds || []));
      setCategoriesCount(data.categoriesUsed || categoryIds.length);
      setSource(data.source || null);
      lastFetchedKey.current = categoryIdsKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao buscar produtos por categoria:', err);
      setError(message);
      setProductIds(new Set());
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [categoryIdsKey, includeDescendants, hasFilter, enabled, categoryIds]);

  // Buscar quando a chave de categorias muda
  useEffect(() => {
    if (categoryIdsKey !== lastFetchedKey.current || !hasFilter) {
      fetchProductIds();
    }
  }, [categoryIdsKey, hasFilter, fetchProductIds]);

  return {
    productIds,
    hasFilter,
    isLoading,
    error,
    categoriesCount,
    source,
    refetch: fetchProductIds,
  };
}

/**
 * Hook auxiliar para buscar descendentes de categorias
 */
export function useCategoryDescendants(categoryIds: string[]) {
  const [descendantIds, setDescendantIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (categoryIds.length === 0) {
      setDescendantIds([]);
      return;
    }

    const fetchDescendants = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('categories-api', {
          body: {
            action: 'descendants',
            categoryIds,
          },
        });

        if (!error && data.success) {
          setDescendantIds(data.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar descendentes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDescendants();
  }, [categoryIds]);

  return { descendantIds, isLoading };
}
