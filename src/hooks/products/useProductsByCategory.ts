import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
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
  // fetchTokenRef: substitui isFetchingRef — cada chamada incrementa o token;
  // resultados de chamadas supersedidas sao descartados, eliminando a condicao de corrida
  // onde filtros rapidos A->B bloqueavam B (isFetchingRef=true) e mostravam o resultado
  // stale de A. Propriedade chave: somente o ultimo fetch em voo aplica setState.
  const fetchTokenRef = useRef(0);

  // Verificar se há filtro ativo
  const hasFilter = useMemo(() => {
    return categoryIds.length > 0;
  }, [categoryIds.length]);

  const fetchProductIds = useCallback(async () => {
    // FIX BUG-CAT-01 (2026-06-18): guard usa apenas lastFetchedKey (useRef, sempre
    // atual). Versão anterior usava `productIds.size > 0` (closure stale): para
    // categorias com 0 produtos, re-fetch extra em cada render. Agora: lastFetchedKey
    // sozinho é suficiente — muda após fetch bem-sucedido ou erro marcado.
    // Forçar re-fetch explícito: chamar refetch(), que reseta lastFetchedKey.current.
    if (lastFetchedKey.current === categoryIdsKey) return;

    if (!hasFilter || !enabled) {
      setProductIds(new Set());
      setCategoriesCount(0);
      setSource(null);
      lastFetchedKey.current = '';
      return;
    }

    const token = ++fetchTokenRef.current;
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

      if (token !== fetchTokenRef.current) return; // superseded
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
      if (token !== fetchTokenRef.current) return; // superseded
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      logger.error('Erro ao buscar produtos por categoria:', err);
      setError(message);
      setProductIds(new Set());
      // Marca a chave como tentada mesmo em erro: sem isto, o effect (key !==
      // lastFetchedKey) re-disparava a cada render — e como fetchProductIds tem
      // identidade instável (categoryIds nas deps) — gerando refetch infinito
      // enquanto a categories-api estiver fora. Retry manual via refetch().
      lastFetchedKey.current = categoryIdsKey;
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // FIX BUG-CAT-01: refetch reseta a chave para forçar re-fetch mesmo da mesma categoria.
    refetch: () => {
      lastFetchedKey.current = '';
      return fetchProductIds();
    },
  };
}

/**
 * Hook auxiliar para buscar descendentes de categorias.
 * FIX GAP-3 (2026-06-19 audit): adicionado fetchTokenRef para prevenir
 * race condition quando categoryIds muda rapidamente. Sem o token, uma
 * resposta stale de uma seleção anterior podia sobrescrever os descendentes
 * corretos, causando expansão incorreta do category tree na UI.
 */
export function useCategoryDescendants(categoryIds: string[]) {
  const [descendantIds, setDescendantIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // fetchTokenRef: cada chamada incrementa o token antes do primeiro await.
  // Verificações após cada await descartam respostas de chamadas supersedidas.
  const fetchTokenRef = useRef(0);

  useEffect(() => {
    if (categoryIds.length === 0) {
      setDescendantIds([]);
      return;
    }

    const fetchDescendants = async () => {
      const token = ++fetchTokenRef.current;
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('categories-api', {
          body: {
            action: 'descendants',
            categoryIds,
          },
        });

        if (token !== fetchTokenRef.current) return; // superseded — nova seleção de categoria
        if (!error && data.success) {
          setDescendantIds(data.data || []);
        }
      } catch (err) {
        if (token !== fetchTokenRef.current) return; // superseded
        logger.error('Erro ao buscar descendentes:', err);
      } finally {
        if (token === fetchTokenRef.current) setIsLoading(false);
      }
    };

    fetchDescendants();
  }, [categoryIds]);

  return { descendantIds, isLoading };
}
