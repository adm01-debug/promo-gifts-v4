/**
 * useProductsByMetadata - Server-side metadata filtering (Super Filtro)
 *
 * Resolve product_ids via a RPC `fn_super_filtro_product_ids` para os filtros de
 * metadados cujo dado vive em tabelas relacionais e NAO e hidratado no catalogo
 * lightweight: Datas Comemorativas, Tags, Ramos/Segmentos de Atividade, Publico-Alvo
 * e Endomarketing (tag slug → filtrado por tags.slug = ANY(_endomarketing)).
 *
 * Antes desta correcao, esses filtros rodavam client-side sobre `product.tags.*`
 * (sempre vazio no fetch lightweight), entao selecionar qualquer um zerava a lista
 * apesar de existirem 34k+ vinculos de datas, 50k+ de tags e 63k+ de nichos.
 *
 * Semantica: AND entre grupos de filtro, OR dentro de cada grupo (identica aos
 * blocos client-side antigos). Espelha useProductsByColor: retorna um Set<product_id>
 * para intersecao client-side com a grade ja carregada.
 */
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '@/lib/logger';

interface UseProductsByMetadataOptions {
  datas: string[]; // commemorative_dates.slug
  tags: string[]; // tags.id (uuid)
  ramos: string[]; // ramo_atividade.slug
  segmentos: string[]; // ramo_atividade_filho.slug
  publico: string[]; // products.target_audience values
  endomarketing: string[]; // tags.slug (e.g. 'endomarketing')
}

interface UseProductsByMetadataResult {
  productIds: Set<string>;
  hasFilter: boolean;
  isLoading: boolean;
  error: unknown;
}

export function useProductsByMetadata({
  datas,
  tags,
  ramos,
  segmentos,
  publico,
  endomarketing,
}: UseProductsByMetadataOptions): UseProductsByMetadataResult {
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const hasFilter = useMemo(
    () =>
      datas.length > 0 ||
      tags.length > 0 ||
      ramos.length > 0 ||
      segmentos.length > 0 ||
      publico.length > 0 ||
      endomarketing.length > 0,
    [
      datas.length,
      tags.length,
      ramos.length,
      segmentos.length,
      publico.length,
      endomarketing.length,
    ],
  );

  const filterKey = useMemo(
    () =>
      [
        [...datas].sort().join(','),
        [...tags].sort().join(','),
        [...ramos].sort().join(','),
        [...segmentos].sort().join(','),
        [...publico].sort().join(','),
        [...endomarketing].sort().join(','),
      ].join('|'),
    [datas, tags, ramos, segmentos, publico, endomarketing],
  );

  const lastFetchedKey = useRef('');
  // fetchTokenRef: substitui isFetchingRef — cada chamada incrementa o token;
  // resultados de chamadas supersedidas sao descartados, eliminando a condicao de corrida
  // onde filtros rapidos A->B bloqueavam B (isFetchingRef=true) e mostravam o resultado
  // stale de A. Propriedade chave: somente o ultimo fetch em voo aplica setState.
  const fetchTokenRef = useRef(0);

  const fetchProductIds = useCallback(async () => {
    if (lastFetchedKey.current === filterKey) return;
    if (!hasFilter) {
      setProductIds(new Set());
      lastFetchedKey.current = '';
      return;
    }

    const token = ++fetchTokenRef.current;
    setIsLoading(true);

    try {
      setError(null);
      // fn_super_filtro_product_ids ainda nao consta nos tipos gerados (types.ts).
      const { data, error: rpcError } = await (
        supabase as unknown as {
          rpc: (
            name: string,
            args: Record<string, unknown>,
          ) => Promise<{ data: unknown; error: unknown }>;
        }
      ).rpc('fn_super_filtro_product_ids', {
        _datas: datas,
        _tags: tags,
        _ramos: ramos,
        _segmentos: segmentos,
        _publico: publico,
        _endomarketing: endomarketing,
      });

      if (token !== fetchTokenRef.current) return; // superseded — nova selecao de filtro
      if (rpcError) throw new Error(String(rpcError));

      const rows = (data as Array<{ product_id: string }> | null) || [];
      setProductIds(new Set(rows.map((r) => r.product_id)));
      lastFetchedKey.current = filterKey;
      logger.log(`[useProductsByMetadata] Found ${rows.length} products`);
    } catch (err) {
      if (token !== fetchTokenRef.current) return; // superseded
      logger.error('[useProductsByMetadata] Critical Error:', err);
      setProductIds(new Set());
      setError(err);
      // Marca como "tentado" para evitar loop de retry no mesmo filterKey.
      lastFetchedKey.current = filterKey;
    } finally {
      if (token === fetchTokenRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, hasFilter]);

  useEffect(() => {
    if (filterKey !== lastFetchedKey.current || !hasFilter) fetchProductIds();
  }, [filterKey, hasFilter, fetchProductIds]);

  return { productIds, hasFilter, isLoading, error };
}
