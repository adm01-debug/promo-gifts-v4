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
    // FIX RENDER-LOOP (2026-06-20): a checagem de desabilitado/sem-filtro vem
    // ANTES do guard de chave. Caso contrário, ao desabilitar (enabled true→false)
    // após um fetch bem-sucedido — quando lastFetchedKey.current === categoryIdsKey —
    // o guard de chave retornava cedo e o estado NUNCA era limpo.
    if (!hasFilter || !enabled) {
      // FIX RENDER-LOOP (2026-06-20): setState CONDICIONAL. A versão anterior
      // chamava setProductIds/setCategoriesCount/setSource incondicionalmente e
      // resetava lastFetchedKey.current = '' — com filtro ativo + enabled=false,
      // o useEffect (key !== lastFetchedKey, 'cat-1' !== '') re-disparava após
      // cada setState, gerando render-loop infinito (82+ renders → timeout no
      // teste e travamento no browser). Agora: só atualiza estado se mudou de
      // fato, e marca a chave com sentinela '\0disabled' (distinto de qualquer
      // categoryIdsKey real) para o effect estabilizar. Ao reabilitar (enabled
      // true) ou trocar categorias, fetchProductIds muda de identidade e o
      // effect reavalia: sentinela !== categoryIdsKey → fetch dispara.
      fetchTokenRef.current += 1; // supersede any in-flight fetch so its finally block won't set isLoading
      setIsLoading(false);
      setProductIds((prev) => (prev.size === 0 ? prev : new Set()));
      setCategoriesCount((prev) => (prev === 0 ? prev : 0));
      setSource((prev) => (prev === null ? prev : null));
      lastFetchedKey.current = `\0disabled:${categoryIdsKey}`;
      return;
    }

    // Guard de chave: evita re-fetch de categoria já buscada com sucesso (ou já
    // marcada como tentada após erro). Forçar re-fetch: refetch() reseta a chave.
    if (lastFetchedKey.current === categoryIdsKey) return;

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

  // Buscar quando a chave de categorias muda, ou quando enabled/hasFilter mudam.
  // FIX RENDER-LOOP (2026-06-20): `enabled` e `!enabled` adicionados à condição
  // E às deps. Sem isto, ao desabilitar (true→false) com filtro ativo, a condição
  // (key !== lastFetchedKey || !hasFilter) era falsa (key estável + hasFilter true)
  // e o estado nunca era limpo. fetchProductIds() é idempotente nos guards internos
  // (bloco !enabled limpa via setState condicional; guard de chave evita re-fetch),
  // então chamá-lo aqui é seguro e não reintroduz loop.
  useEffect(() => {
    if (categoryIdsKey !== lastFetchedKey.current || !hasFilter || !enabled) {
      fetchProductIds();
    }
  }, [categoryIdsKey, hasFilter, enabled, fetchProductIds]);

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

  // FIX RENDER-LOOP (2026-06-20): estabilizar a dependência do effect. A versão
  // anterior usava deps [categoryIds] (array bruto, referência nova a cada render
  // do pai): com array inline não-memoizado, o effect re-disparava a cada render,
  // e setDescendantIds([]) no ramo vazio criava um array novo a cada vez,
  // realimentando o ciclo. Agora a chave string é estável e o setState do ramo
  // vazio é condicional (bail-out do React quando já está vazio).
  const categoryIdsKey = useMemo(() => [...categoryIds].sort().join(','), [categoryIds]);

  useEffect(() => {
    if (categoryIdsKey === '') {
      fetchTokenRef.current += 1; // supersede any in-flight fetch so its finally block won't set isLoading
      setIsLoading(false);
      setDescendantIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const idsForFetch = categoryIdsKey.split(',');
    const fetchDescendants = async () => {
      const token = ++fetchTokenRef.current;
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('categories-api', {
          body: {
            action: 'descendants',
            categoryIds: idsForFetch,
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
  }, [categoryIdsKey]);

  return { descendantIds, isLoading };
}
